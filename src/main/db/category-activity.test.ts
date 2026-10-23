import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { initDb } from '../db';
import { createCategoryService } from '../categories';
import { createProfileService } from '../profiles';
import { createTransactionService } from '../transactions';
import {
  creditCardsTable,
  creditCardInvoicesTable,
  installmentsTable,
  transactionsTable,
} from './schema';

test('category activity counts recorded purchases once by reference month and isolates profiles', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  const profiles = createProfileService(db);
  const first = profiles.create({
    name: 'First',
    email: 'first@activity.test',
    locale: 'en-US',
  });
  const second = profiles.create({
    name: 'Second',
    email: 'second@activity.test',
    locale: 'en-US',
  });
  assert.ok(first.ok && second.ok);
  profiles.enter(first.profile.id);
  const service = createCategoryService(db, () => profiles.requireActive());
  const category = service.list().find((row) => row.catalog_key === 'food')!;
  const payment = profiles.options().payments[0].id;
  const card = db
    .insert(creditCardsTable)
    .values({ name: 'Card', user_id: first.profile.id })
    .returning()
    .get();
  const invoice = db
    .insert(creditCardInvoicesTable)
    .values({
      credit_card_id: card.id,
      amount_cents: 999999,
      closing_date: '2026-02-20',
      due_date: '2026-03-01',
      paid_at: '2026-03-02',
    })
    .returning()
    .get();
  const plan = db
    .insert(installmentsTable)
    .values({
      name: 'Plan',
      total_installments: 2,
      total_amount_cents: 1000,
      start_date: '2026-02-01',
      end_date: '2026-03-01',
      purchase_at: '2026-01-10',
      user_id: first.profile.id,
    })
    .returning()
    .get();
  const base = {
    name: 'Entry',
    type: 2 as const,
    amount_cents: 100,
    user_id: first.profile.id,
    category_id: category.id,
    payment_id: payment,
    reference_date: '2026-02-01',
  };

  try {
    db.insert(transactionsTable)
      .values([
        base,
        {
          ...base,
          amount_cents: 250,
          reference_date: '2026-02-28',
          payment_date: '2026-03-02',
          credit_card_invoice_id: invoice.id,
        },
        {
          ...base,
          amount_cents: 500,
          reference_date: '2026-02-28',
          installment_id: plan.id,
          installment_number: 1,
        },
        { ...base, amount_cents: 700, type: 1, reference_date: '2026-02-02' },
        {
          ...base,
          amount_cents: 500,
          reference_date: '2026-03-01',
          installment_id: plan.id,
          installment_number: 2,
        },
        { ...base, reference_date: '2026-01-31', payment_date: '2026-02-01' },
        { ...base, category_id: null },
        { ...base, user_id: second.profile.id },
      ])
      .run();
    // Archival and compatibility edits must not remove or reclassify historical activity.
    service.archive(category.id);
    const result = service.activity('2026-02');
    assert.equal(result.length, 1);
    const activity = result[0];
    assert.equal(activity.category_id, category.id);
    assert.equal(activity.expense_cents, 850);
    assert.equal(activity.income_cents, 700);
    assert.equal(activity.entry_count, 4);
    assert.equal(activity.expense_daily_cents.length, 28);
    assert.equal(activity.expense_daily_cents[0], 100);
    assert.equal(activity.expense_daily_cents[27], 750);
    assert.equal(activity.income_daily_cents[1], 700);
    assert.equal(service.activity('2024-02').length, 0);
    assert.equal(service.activity('2026-03')[0].expense_cents, 500);
    profiles.enter(second.profile.id);
    assert.deepEqual(service.activity('2026-02'), []);
    assert.throws(() => service.activity('2026-13'), /Invalid activity month/);
    assert.throws(() => service.activity('2026-2'), /Invalid activity month/);
    assert.throws(
      () => service.activity(null as unknown as string),
      /Invalid activity month/,
    );
    profiles.leave();
    assert.throws(() => service.activity('2026-02'));
  } finally {
    db.$client.close();
  }
});

for (const type of [1, 2] as const) {
  for (const sameDay of [true, false]) {
    test(`category activity preserves safe cents and rejects ${type === 1 ? 'income' : 'expense'} overflow ${sameDay ? 'on one day' : 'across days'}`, () => {
      const db = initDb(':memory:', resolve('drizzle'));
      try {
        const profiles = createProfileService(db);
        const profile = profiles.create({
          name: 'Precision',
          email: 'precision@activity.test',
          locale: 'en-US',
        });
        assert.ok(profile.ok);
        const categories = createCategoryService(db, () =>
          profiles.requireActive(),
        );
        const transactions = createTransactionService(db, () =>
          profiles.requireActive(),
        );
        const category = categories
          .list()
          .find((row) => row.catalog_key === 'other')!;
        const payment = profiles
          .options()
          .payments.find((row) => row.catalog_key === 'cash')!;
        const base = {
          name: 'Precision boundary',
          type,
          amount_cents: Number.MAX_SAFE_INTEGER - 2,
          user_id: profile.profile.id,
          category_id: category.id,
          payment_id: payment.id,
          reference_date: '2026-02-01',
          payment_date: null,
        };
        transactions.create(base);
        const date = sameDay ? '2026-02-01' : '2026-02-02';
        transactions.create({ ...base, amount_cents: 2, reference_date: date });
        // Each direction has its own limit; safe income and expense must not be added together.
        transactions.create({
          ...base,
          type: type === 1 ? 2 : 1,
          amount_cents: Number.MAX_SAFE_INTEGER,
        });
        const [activity] = categories.activity('2026-02');
        assert.equal(activity.income_cents, Number.MAX_SAFE_INTEGER);
        assert.equal(activity.expense_cents, Number.MAX_SAFE_INTEGER);
        const daily =
          type === 1
            ? activity.income_daily_cents
            : activity.expense_daily_cents;
        assert.equal(
          daily[0],
          sameDay ? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER - 2,
        );
        assert.equal(daily[1], sameDay ? 0 : 2);
        transactions.create({ ...base, amount_cents: 2, reference_date: date });
        assert.throws(
          () => categories.activity('2026-02'),
          /Category activity exceeds the supported amount/,
        );
        assert.equal(db.select().from(transactionsTable).all().length, 4);
        assert.deepEqual(categories.activity('2026-03'), []);
      } finally {
        db.$client.close();
      }
    });
  }
}
