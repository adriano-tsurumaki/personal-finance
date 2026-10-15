import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { initDb } from '../db';

test('recurrence upgrade preserves version links and leaves ambiguous legacy slots for repair', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-recurrence-upgrade-'));
  const folder = join(directory, 'drizzle');
  const filename = join(directory, 'history.db');
  let db: ReturnType<typeof initDb> | undefined;
  try {
    cpSync(resolve('drizzle'), folder, { recursive: true });
    const latest = readdirSync(folder).find((name) =>
      name.endsWith('_recurrence_decisions'),
    )!;
    rmSync(join(folder, latest), { recursive: true });
    db = initDb(filename, folder);
    db.$client.exec(`
      INSERT INTO user (id,name,email,password) VALUES (1,'Existing','existing@example.test','preserved');
      INSERT INTO payments (id,name,type) VALUES (1,'Cash',1);
      INSERT INTO recurrences (id,name,user_id) VALUES (1,'Legacy subscription',1);
      INSERT INTO recurrences_versions (id,version,name,amount_cents,frequency,interval,start_date,recurrence_id)
        VALUES (1,1,'Legacy subscription',1500,3,1,'2026-01-01',1);
      INSERT INTO transactions (id,name,type,amount_cents,reference_date,user_id,payment_id,recurrence_version_id)
        VALUES (1,'Moved legacy entry',2,1700,'2026-03-25',1,1,1);
    `);
    db.$client.close();
    cpSync(join(resolve('drizzle'), latest), join(folder, latest), {
      recursive: true,
    });
    db = initDb(filename, folder);
    assert.deepEqual(
      db.$client.prepare('SELECT id,status,anchor_date FROM recurrences').get(),
      { id: 1, status: 'repair_required', anchor_date: null },
    );
    assert.deepEqual(
      db.$client
        .prepare(
          'SELECT recurrence_version_id,reference_date,amount_cents FROM transactions',
        )
        .get(),
      {
        recurrence_version_id: 1,
        reference_date: '2026-03-25',
        amount_cents: 1700,
      },
    );
    assert.equal(
      db.$client
        .prepare('SELECT count(*) AS count FROM recurrence_occurrences')
        .get() &&
        (
          db.$client
            .prepare('SELECT count(*) AS count FROM recurrence_occurrences')
            .get() as { count: number }
        ).count,
      0,
    );
    assert.deepEqual(db.$client.prepare('PRAGMA foreign_key_check').all(), []);
    db.$client.close();
    db = initDb(filename, folder);
    assert.equal(
      (
        db.$client
          .prepare('SELECT count(*) AS count FROM transactions')
          .get() as { count: number }
      ).count,
      1,
    );
    db.$client.exec(
      "INSERT INTO recurrence_occurrences (recurrence_id,scheduled_date,recurrence_version_id,state,transaction_id) VALUES (1,'2026-01-01',1,'confirmed',1)",
    );
    assert.throws(() =>
      db!.$client.exec(
        "INSERT INTO recurrence_occurrences (recurrence_id,scheduled_date,recurrence_version_id,state) VALUES (1,'2026-01-01',1,'ignored')",
      ),
    );
    assert.throws(() =>
      db!.$client.exec(
        "INSERT INTO recurrence_occurrences (recurrence_id,scheduled_date,recurrence_version_id,state) VALUES (1,'2026-02-01',1,'confirmed')",
      ),
    );
    assert.throws(() =>
      db!.$client.exec(
        "INSERT INTO recurrence_occurrences (recurrence_id,scheduled_date,recurrence_version_id,state,transaction_id) VALUES (1,'2026-02-01',1,'confirmed',1)",
      ),
    );
  } finally {
    if (db?.$client.open) {
      db.$client.close();
    }

    rmSync(directory, { recursive: true, force: true });
  }
});

test('complete rules enforce non-overlapping versions while retaining inactive provenance', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  try {
    db.$client.exec(`
      INSERT INTO user (id,name,email,password) VALUES (1,'Owner','owner@example.test','preserved');
      INSERT INTO payments (id,name,type) VALUES (1,'Cash',1);
      INSERT INTO recurrences (id,name,user_id,status,anchor_date) VALUES (1,'Subscription',1,'active','2026-01-31');
      INSERT INTO recurrences_versions (id,version,name,amount_cents,frequency,interval,start_date,end_date,recurrence_id,type,payment_id)
        VALUES (1,1,'First',1000,3,1,'2026-01-31','2026-03-31',1,2,1);
    `);
    assert.throws(
      () =>
        db.$client.exec(
          `INSERT INTO recurrences_versions (version,name,amount_cents,frequency,interval,start_date,recurrence_id,type,payment_id) VALUES (2,'Overlap',1500,3,1,'2026-02-28',1,2,1)`,
        ),
      /Overlapping/,
    );
    db.$client.exec(
      `INSERT INTO recurrences_versions (id,version,name,amount_cents,frequency,interval,start_date,recurrence_id,type,payment_id) VALUES (2,2,'Second',1500,3,1,'2026-03-31',1,2,1)`,
    );
    assert.throws(
      () =>
        db.$client.exec(
          "UPDATE recurrences_versions SET start_date='2026-02-28' WHERE id=2",
        ),
      /Overlapping/,
    );
    assert.throws(
      () =>
        db.$client.exec(
          'UPDATE recurrences_versions SET end_date=start_date WHERE id=2',
        ),
      /Invalid/,
    );
    db.$client.exec(
      'UPDATE recurrences_versions SET end_date=start_date, active=0 WHERE id=2',
    );
    db.$client.exec(
      `INSERT INTO recurrences_versions (version,name,amount_cents,frequency,interval,start_date,recurrence_id,type,payment_id) VALUES (3,'Resumed',1600,3,1,'2026-03-31',1,2,1)`,
    );
    assert.equal(
      (
        db.$client
          .prepare('SELECT count(*) AS count FROM recurrences_versions')
          .get() as { count: number }
      ).count,
      3,
    );
  } finally {
    db.$client.close();
  }
});
