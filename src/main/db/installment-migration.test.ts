import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createInstallmentService } from '../installments';
import { createCreditCardService } from '../credit-cards';
import { installmentsTable, transactionsTable } from './schema';
import type { InstallmentInput } from '@shared/contracts/installment';

test('installment upgrade preserves existing rows and durable receipts survive application restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-installment-upgrade-'));
  const folder = join(directory, 'migrations');
  const filename = join(directory, 'history.db');
  mkdirSync(folder);
  const migrations = readdirSync(resolve('drizzle')).sort();
  const latest = migrations.find((name) =>
    name.endsWith('_installment_requests'),
  )!;
  let db: ReturnType<typeof initDb> | undefined;
  try {
    for (const name of migrations.filter((name) => name < latest)) {
      cpSync(join(resolve('drizzle'), name), join(folder, name), {
        recursive: true,
      });
    }

    db = initDb(filename, folder);
    let profiles = createProfileService(db);
    const result = profiles.create({
      name: 'Existing',
      email: 'upgrade@example.test',
      locale: 'en-US',
    });
    assert.ok(result.ok);
    const input: InstallmentInput = {
      request_id: 'upgrade-request-0001',
      name: 'Purchase',
      note: null,
      total_amount_cents: 5000,
      total_installments: 2,
      start_date: '2027-01-31',
      purchase_at: '2027-01-15',
      category_id: null,
      card_id: null,
      historical_card: false,
      invoice_ids: [],
      payment_id: profiles
        .options()
        .payments.find((row) => row.catalog_key === 'pix')!.id,
    };
    // Seed the historical schema independently of current transaction columns.
    db.$client
      .prepare(
        'INSERT INTO transactions (name, type, amount_cents, reference_date, payment_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        'Existing entry',
        2,
        100,
        '2026-10-19',
        input.payment_id,
        result.profile.id,
      );
    const group = db
      .insert(installmentsTable)
      .values({
        name: 'Legacy',
        total_installments: 2,
        total_amount_cents: 200,
        start_date: '2027-01-31',
        end_date: '2027-02-28',
        purchase_at: '2027-01-15',
        user_id: result.profile.id,
      })
      .returning()
      .get()!;

    for (const [index, date] of ['2027-01-31', '2027-02-28'].entries()) {
      db.$client
        .prepare(
          'INSERT INTO transactions (name, type, amount_cents, reference_date, payment_id, user_id, installment_id, installment_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'Legacy',
          2,
          100,
          date,
          input.payment_id,
          result.profile.id,
          group.id,
          index + 1,
        );
    }

    const before = db.$client
      .prepare('SELECT * FROM transactions')
      .all()
      .map((row) => ({
        ...(row as object),
        financing: null,
        financing_terms: null,
      }));
    db.$client.close();
    for (const name of migrations.filter((name) => name >= latest)) {
      cpSync(join(resolve('drizzle'), name), join(folder, name), {
        recursive: true,
      });
    }
    db = initDb(filename, folder);
    profiles = createProfileService(db);
    profiles.enter(result.profile.id);
    assert.deepEqual(db.select().from(transactionsTable).all(), before);
    let plans = createInstallmentService(db, () => profiles.requireActive());
    assert.equal(plans.list()[0].repair_required, false);
    input.installment_amounts_cents = [2000, 3000];
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.card_id = createCreditCardService(db, () =>
      profiles.requireActive(),
    ).create({
      name: 'New credit plan',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    const preview = plans.preview(input);
    const id = plans.create(input, preview.correction.token);
    db.$client.close();
    db = initDb(filename, folder);
    profiles = createProfileService(db);
    profiles.enter(result.profile.id);
    plans = createInstallmentService(db, () => profiles.requireActive());
    assert.equal(plans.create(input, preview.correction.token), id);
    assert.equal(plans.list().length, 2);
    assert.deepEqual(
      plans
        .list()
        .find((plan) => plan.id === id)!
        .entries.map((entry) => entry.amount_cents),
      [2000, 3000],
    );
    assert.deepEqual(db.$client.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    if (db?.$client.open) {
      db.$client.close();
    }

    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
});
