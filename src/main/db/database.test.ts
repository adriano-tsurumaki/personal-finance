import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb } from '../db';
import { createTransactionService, TEST_USER_EMAIL } from '../transactions';
import {
  categoriesTable,
  installmentsTable,
  paymentsTable,
  recurrenceVersionsTable,
  recurrencesTable,
  transactionsTable,
  usersTable,
} from './schema';

const migrationsFolder = resolve('drizzle');
const migrationCount = readdirSync(migrationsFolder, {
  withFileTypes: true,
}).filter((entry) => entry.isDirectory()).length;

function setup() {
  const db = initDb(':memory:', migrationsFolder);
  const service = createTransactionService(db);
  const user = db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, TEST_USER_EMAIL))
    .get()!;
  const payment = db.select().from(paymentsTable).get()!;
  const category = db.select().from(categoriesTable).get()!;
  const input = {
    user_id: user.id,
    name: ' Groceries ',
    note: null,
    type: 2 as const,
    amount_cents: 12345,
    reference_date: '2026-12-31',
    payment_date: null,
    payment_id: payment.id,
    category_id: category.id,
  };
  return { db, service, user, category, input };
}

test('CRUD preserves cents, category joins, month boundaries, ordering and seed idempotence', () => {
  const { db, service, input } = setup();
  try {
    createTransactionService(db);
    assert.equal(db.select().from(usersTable).all().length, 1);
    assert.equal(db.select().from(paymentsTable).all().length, 3);
    assert.equal(db.select().from(categoriesTable).all().length, 4);
    service.create(input);
    service.create({ ...input, name: 'Uncategorized', category_id: null });
    service.create({ ...input, reference_date: '2027-01-01' });
    const rows = service.list('2026-12');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].category, null);
    assert.equal(rows[1].category?.icon_key, 'food');
    assert.equal(rows[1].name, 'Groceries');
    assert.equal(rows[1].amount_cents, 12345);
    assert.deepEqual(service.get(rows[1].id), {
      ...input,
      name: 'Groceries',
    });
    assert.equal(service.list('2027-01').length, 1);
    service.update(rows[1].id, {
      ...input,
      amount_cents: 999,
      payment_date: '2027-01-02',
    });
    assert.equal(service.list('2026-12')[1].amount_cents, 999);
    service.remove(rows[0].id);
    assert.equal(service.list('2026-12').length, 1);
  } finally {
    db.$client.close();
  }
});

test('optional notes can be created, edited, preserved when omitted and cleared', () => {
  const { db, service, input } = setup();
  try {
    service.create({ ...input, note: '  Weekly groceries  ' });
    const entry = service.list('2026-12')[0];
    assert.equal(entry.note, 'Weekly groceries');
    assert.equal(service.get(entry.id).note, 'Weekly groceries');
    service.update(entry.id, { ...input, note: 'Updated note' });
    assert.equal(service.get(entry.id).note, 'Updated note');
    const { note: omittedNote, ...withoutNote } = service.get(entry.id);
    assert.equal(omittedNote, 'Updated note');
    service.update(entry.id, withoutNote);
    assert.equal(service.get(entry.id).note, 'Updated note');
    service.update(entry.id, { ...input, note: '   ' });
    assert.equal(service.get(entry.id).note, null);
    service.create({ ...input, note: undefined });
    assert.equal(service.list('2026-12')[0].note, null);
    assert.throws(
      () => service.create({ ...input, note: 123 } as unknown as typeof input),
      /must be text/,
    );
  } finally {
    db.$client.close();
  }
});

test('validation and ownership reject invalid writes and hide other users', () => {
  const { db, service, input, category } = setup();
  try {
    for (const patch of [
      { amount_cents: 1.5 },
      { amount_cents: 0 },
      { reference_date: '2026-02-30' },
      { name: '' },
      { payment_id: 99999 },
    ]) {
      assert.throws(() => service.create({ ...input, ...patch }));
    }
    assert.throws(() => service.list('2026-13'));
    assert.throws(() => service.remove(0));
    const other = db
      .insert(usersTable)
      .values({
        name: 'Other',
        email: 'other@example.test',
        password: 'disabled',
      })
      .returning()
      .get()!;
    const otherCategory = db
      .insert(categoriesTable)
      .values({ name: 'Private', color: '#fff', user_id: other.id })
      .returning()
      .get()!;
    assert.throws(
      () => service.create({ ...input, category_id: otherCategory.id }),
      /Invalid category/,
    );
    const otherEntry = db
      .insert(transactionsTable)
      .values({ ...input, user_id: other.id, category_id: null })
      .returning()
      .get()!;
    assert.equal(service.list('2026-12').length, 0);
    assert.throws(() => service.update(otherEntry.id, input), /not found/);
    assert.throws(() => service.remove(otherEntry.id), /not found/);
    db.update(categoriesTable)
      .set({ archived_at: '2026-01-01' })
      .where(eq(categoriesTable.id, category.id))
      .run();
    assert.throws(() => service.create(input), /Invalid category/);
    assert.equal(db.select().from(transactionsTable).all().length, 1);
  } finally {
    db.$client.close();
  }
});

test('historical reads and updates preserve existing archived categories without allowing new associations', () => {
  const { db, service, input, category } = setup();
  try {
    service.create(input);
    const entry = service.list('2026-12')[0];
    db.update(categoriesTable)
      .set({ archived_at: '2026-12-31' })
      .where(eq(categoriesTable.id, category.id))
      .run();
    const historical = service.get(entry.id);
    assert.equal(historical.category_id, category.id);
    assert.equal(historical.payment_date, null);
    service.update(entry.id, { ...historical, name: 'Corrected name' });
    assert.equal(service.get(entry.id).name, 'Corrected name');
    assert.throws(() => service.create(input), /Invalid category/);
    service.create({ ...input, category_id: null });
    const uncategorized = service.list('2026-12')[0];
    assert.throws(
      () => service.update(uncategorized.id, input),
      /Invalid category/,
    );
    assert.throws(() => service.get(0), /Invalid identifier/);
    assert.throws(() => service.get(99999), /not found/);
  } finally {
    db.$client.close();
  }
});

test('changing the reference month preserves pending and settled payment dates', () => {
  const { db, service, input } = setup();
  try {
    for (const paymentDate of [null, '2027-01-02']) {
      service.create({ ...input, payment_date: paymentDate });
      const entry = service.list('2026-12')[0];
      service.update(entry.id, {
        ...service.get(entry.id),
        reference_date: '2027-02-10',
      });
      assert.equal(service.list('2026-12').length, 0);
      const moved = service.list('2027-02').find((row) => row.id === entry.id)!;
      assert.equal(moved.reference_date, '2027-02-10');
      assert.equal(moved.payment_date, paymentDate);
    }
  } finally {
    db.$client.close();
  }
});

test('schema enforces foreign keys, recurrence checks and installment uniqueness', () => {
  const { db, user, input } = setup();
  try {
    assert.throws(() =>
      db
        .insert(transactionsTable)
        .values({ ...input, user_id: 99999 })
        .run(),
    );
    assert.throws(() =>
      db
        .insert(transactionsTable)
        .values({ ...input, user_id: user.id, installment_number: 1 })
        .run(),
    );
    const installment = db
      .insert(installmentsTable)
      .values({
        name: 'Purchase',
        user_id: user.id,
        total_installments: 2,
        total_amount_cents: 24690,
        start_date: '2026-12-31',
        end_date: '2027-01-31',
        purchase_at: '2026-12-31',
      })
      .returning()
      .get()!;
    const entry = {
      ...input,
      user_id: user.id,
      installment_id: installment.id,
      installment_number: 1,
    };
    db.insert(transactionsTable).values(entry).run();
    assert.throws(() => db.insert(transactionsTable).values(entry).run());
    assert.throws(() =>
      db
        .insert(recurrencesTable)
        .values({ name: 'Invalid', user_id: user.id, active: 2 })
        .run(),
    );
    const recurrence = db
      .insert(recurrencesTable)
      .values({ name: 'Rent', user_id: user.id })
      .returning()
      .get()!;
    const version = {
      recurrence_id: recurrence.id,
      version: 1,
      name: 'Rent',
      amount_cents: 10000,
      frequency: 3,
      interval: 1,
      start_date: '2026-01-01',
    };
    assert.throws(() =>
      db
        .insert(recurrenceVersionsTable)
        .values({ ...version, interval: 0 })
        .run(),
    );
    assert.throws(() =>
      db
        .insert(recurrenceVersionsTable)
        .values({ ...version, frequency: 5 })
        .run(),
    );
    db.insert(recurrenceVersionsTable).values(version).run();
    assert.throws(() =>
      db.insert(recurrenceVersionsTable).values(version).run(),
    );
  } finally {
    db.$client.close();
  }
});

test('legacy database adoption and later migrations preserve data and run only once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-migrations-'));
  const filename = join(directory, 'legacy.db');
  const folder = join(directory, 'drizzle');
  cpSync(migrationsFolder, folder, { recursive: true });
  try {
    const legacy = drizzle(filename);
    legacy.$client.exec(
      readFileSync(resolve('src/main/db/fixtures/legacy-schema.sql'), 'utf8'),
    );
    legacy
      .insert(usersTable)
      .values({
        id: 42,
        name: 'Existing',
        email: 'existing@example.test',
        password: 'preserved',
      })
      .run();
    const payment = legacy
      .insert(paymentsTable)
      .values({ name: 'Cash', type: 1 })
      .returning()
      .get()!;
    const category = legacy
      .insert(categoriesTable)
      .values({ name: 'Food', color: '#808080', icon_key: 'food', user_id: 42 })
      .returning()
      .get()!;
    // Insert against the historical schema, which does not have the note column.
    legacy.run(sql`INSERT INTO transactions
      (id, name, type, amount_cents, reference_date, payment_date, user_id, payment_id, category_id)
      VALUES (73, 'Historical entry', 2, 12345, '2026-09-01', NULL, 42, ${payment.id}, ${category.id})`);
    legacy.$client.close();
    let db = initDb(filename, folder);
    assert.equal(db.select().from(usersTable).get()!.id, 42);
    assert.equal(
      db.select().from(transactionsTable).get()!.amount_cents,
      12345,
    );
    assert.equal(db.select().from(transactionsTable).get()!.id, 73);
    assert.equal(db.select().from(transactionsTable).get()!.note, null);
    assert.equal(db.select().from(categoriesTable).get()!.icon_key, 'food');
    assert.deepEqual(db.all(sql`PRAGMA foreign_key_check`), []);
    db.$client.close();
    const next = join(folder, '20990101000000_add_note');
    mkdirSync(next);
    writeFileSync(
      join(next, 'migration.sql'),
      'ALTER TABLE user ADD COLUMN note TEXT;',
    );
    db = initDb(filename, folder);
    db.run(sql`UPDATE user SET note = 'preserved note' WHERE id = 42`);
    db.update(transactionsTable)
      .set({ note: 'Historical note' })
      .where(eq(transactionsTable.id, 73))
      .run();
    db.$client.close();
    db = initDb(filename, folder);
    assert.equal(
      db.get<{ note: string }>(sql`SELECT note FROM user WHERE id = 42`)!.note,
      'preserved note',
    );
    assert.equal(
      db.select().from(transactionsTable).get()!.note,
      'Historical note',
    );
    assert.equal(
      db.all(sql`SELECT * FROM __drizzle_migrations`).length,
      migrationCount + 1,
    );
    db.$client.close();
    const failed = join(folder, '20990102000000_failure');
    mkdirSync(failed);
    writeFileSync(
      join(failed, 'migration.sql'),
      "UPDATE user SET name = 'changed';\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);",
    );
    assert.throws(() => initDb(filename, folder));
    const check = drizzle(filename);
    assert.equal(check.select().from(usersTable).get()!.name, 'Existing');
    assert.equal(
      check.all(sql`SELECT * FROM __drizzle_migrations`).length,
      migrationCount + 1,
    );
    check.$client.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
