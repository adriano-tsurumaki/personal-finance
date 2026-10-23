import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createCategoryService } from '../categories';
import { demoProfileEmail, recreateDemoProfile } from './demo-profile';
import {
  categoriesTable,
  paymentsTable,
  transactionsTable,
  usersTable,
  creditCardsTable,
  creditCardInvoicesTable,
  cardHistoryTable,
  installmentsTable,
  installmentRequestsTable,
  recurrencesTable,
  recurrenceVersionsTable,
  recurrenceOccurrencesTable,
  recurrenceInvoiceCoverageTable,
  indicatorAnchorsTable,
} from './schema';

test('demo covers category card data states and recreates only its own profile', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  try {
    const profiles = createProfileService(db);
    const personal = profiles.create({
      name: 'Personal',
      email: 'personal@example.invalid',
      locale: 'en-US',
    });
    assert.ok(personal.ok);
    const originalCategories = db
      .select()
      .from(categoriesTable)
      .orderBy(categoriesTable.id)
      .all();
    const first = recreateDemoProfile(db, '2026-02');
    assert.equal(first.categories, 103);
    assert.equal(first.transactions, 16236);
    const service = createCategoryService(db, () => ({ id: first.profileId }));
    const categories = service.list();
    const activity = service.activity('2026-02');
    assert.equal(activity.length, 66);
    assert.equal(
      activity.reduce((sum, row) => sum + row.entry_count, 0),
      1353,
    );
    assert.equal(service.activity('2025-02').length, 0);
    assert.equal(service.activity('2025-03').length, 66);

    for (const archived of [false, true]) {
      for (const type of ['income', 'expense', 'both']) {
        const subset = categories.filter(
          (row) =>
            !!row.archived_at === archived && row.transaction_type === type,
        );
        assert.ok(subset.length > 0);
        assert.ok(subset.some((row) => row.description === null));
        assert.ok(subset.some((row) => (row.description?.length ?? 0) > 150));
        assert.ok(
          subset.some(
            (row) => !activity.some((item) => item.category_id === row.id),
          ),
        );
        assert.ok(
          subset.some((row) =>
            activity.some(
              (item) => item.category_id === row.id && item.entry_count === 1,
            ),
          ),
        );
        assert.ok(
          subset.some((row) =>
            activity.some(
              (item) =>
                item.category_id === row.id &&
                item.income_cents > 0 &&
                item.expense_cents > 0,
            ),
          ),
        );
      }
    }

    assert.ok(activity.every((row) => row.income_daily_cents.length === 28));
    assert.ok(
      service
        .activity('2025-03')
        .every((row) => row.expense_daily_cents.length === 31),
    );
    assert.deepEqual(
      db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.user_id, personal.profile.id))
        .orderBy(categoriesTable.id)
        .all(),
      originalCategories,
    );
    const methods = db.select().from(paymentsTable).all();
    db.insert(transactionsTable)
      .values({
        name: 'Personal entry',
        type: 2,
        amount_cents: 100,
        reference_date: '2026-02-01',
        user_id: personal.profile.id,
        payment_id: methods[0].id,
        category_id: originalCategories[0].id,
      })
      .run();
    db.insert(categoriesTable)
      .values({
        name: 'Exploration',
        color: '#abcdef',
        user_id: first.profileId,
      })
      .run();

    const card = db
      .insert(creditCardsTable)
      .values({ name: 'Exploration card', user_id: first.profileId })
      .returning()
      .get();
    const invoice = db
      .insert(creditCardInvoicesTable)
      .values({
        credit_card_id: card.id,
        amount_cents: 100,
        closing_date: '2026-02-20',
        due_date: '2026-02-25',
      })
      .returning()
      .get();
    const plan = db
      .insert(installmentsTable)
      .values({
        name: 'Exploration plan',
        total_installments: 1,
        total_amount_cents: 100,
        start_date: '2026-02-01',
        end_date: '2026-02-01',
        purchase_at: '2026-02-01',
        user_id: first.profileId,
      })
      .returning()
      .get();
    db.insert(installmentRequestsTable)
      .values({
        user_id: first.profileId,
        request_id: 'exploration',
        input_json: '{}',
        installment_id: plan.id,
      })
      .run();
    const rule = db
      .insert(recurrencesTable)
      .values({ name: 'Exploration rule', user_id: first.profileId })
      .returning()
      .get();
    const version = db
      .insert(recurrenceVersionsTable)
      .values({
        recurrence_id: rule.id,
        version: 1,
        name: 'Exploration version',
        amount_cents: 100,
        frequency: 1,
        interval: 1,
        start_date: '2026-02-01',
        category_id: categories[0].id,
        credit_card_id: card.id,
      })
      .returning()
      .get();
    const entry = db
      .insert(transactionsTable)
      .values({
        name: 'Exploration entry',
        type: 2,
        amount_cents: 100,
        reference_date: '2026-02-01',
        user_id: first.profileId,
        payment_id: methods[0].id,
        category_id: categories[0].id,
        recurrence_version_id: version.id,
        credit_card_invoice_id: invoice.id,
        installment_id: plan.id,
        installment_number: 1,
      })
      .returning()
      .get();
    db.insert(recurrenceOccurrencesTable)
      .values({
        recurrence_id: rule.id,
        recurrence_version_id: version.id,
        scheduled_date: '2026-02-01',
        state: 'confirmed',
        transaction_id: entry.id,
      })
      .run();
    db.insert(recurrenceInvoiceCoverageTable)
      .values({
        recurrence_id: rule.id,
        scheduled_date: '2026-02-01',
        credit_card_invoice_id: invoice.id,
        status: 'included',
      })
      .run();
    db.insert(cardHistoryTable)
      .values({
        user_id: first.profileId,
        credit_card_id: card.id,
        operation: 'exploration',
        created_at: '2026-02-01',
        changes_json: '{}',
      })
      .run();
    db.insert(indicatorAnchorsTable)
      .values({
        user_id: first.profileId,
        start_date: '2026-02-01',
        opening_balance_cents: 100,
      })
      .run();

    // Any insert failure must restore the previous demo, including exploratory changes.
    db.$client.exec(
      "CREATE TRIGGER fail_demo BEFORE INSERT ON categories WHEN NEW.name = 'Salary reserve' BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END",
    );
    assert.throws(
      () => recreateDemoProfile(db, '2026-02'),
      (error: unknown) =>
        error instanceof Error &&
        error.cause instanceof Error &&
        error.cause.message === 'Simulated failure',
    );
    assert.equal(
      db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.user_id, first.profileId))
        .all().length,
      104,
    );
    db.$client.exec('DROP TRIGGER fail_demo');

    const second = recreateDemoProfile(db, '2026-03');
    assert.notEqual(second.profileId, first.profileId);
    assert.equal(second.categories, first.categories);
    assert.equal(second.transactions, first.transactions);
    assert.equal(db.select().from(usersTable).all().length, 2);
    assert.equal(
      db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.user_id, first.profileId))
        .all().length,
      0,
    );
    assert.equal(
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactionsTable)
        .get()!.count,
      second.transactions + 1,
    );
    assert.deepEqual(db.select().from(paymentsTable).all(), methods);
    assert.equal(db.select().from(creditCardsTable).all().length, 0);
    assert.equal(db.select().from(recurrencesTable).all().length, 0);
    assert.equal(profiles.current()?.id, personal.profile.id);
    assert.deepEqual(db.$client.pragma('foreign_key_check'), []);
  } finally {
    db.$client.close();
  }
});

test('demo rejects a reserved email collision and invalid dates without changing data', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  try {
    const profiles = createProfileService(db);
    const result = profiles.create({
      name: 'Real profile',
      email: demoProfileEmail,
      locale: 'en-US',
    });
    assert.ok(result.ok);
    assert.throws(
      () => recreateDemoProfile(db, '2026-13'),
      /Invalid demo month/,
    );
    assert.throws(() => recreateDemoProfile(db), /non-demo profile/);
    assert.equal(profiles.list().length, 1);
    assert.equal(profiles.list()[0].id, result.profile.id);
  } finally {
    db.$client.close();
  }
});
