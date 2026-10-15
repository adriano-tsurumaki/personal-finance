import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createRecurrenceService } from '../recurrences';
import { createMonthlyStatementService } from '../monthly-statement';
import { createFinancialMonthService } from '../financial-month';
import { createCreditCardService } from '../credit-cards';
import { createTransactionService } from '../transactions';
import { previewRecurrenceBoundary } from '../recurrences/boundary-preview';
import type { RecurrenceCreateInput } from '@shared/contracts/recurrence';

function fixture() {
  const db = initDb(':memory:', resolve('drizzle'));
  const profiles = createProfileService(db);
  const created = profiles.create({
    name: 'Projection owner',
    email: 'projection@example.test',
    locale: 'en-US',
  });
  assert.ok(created.ok);
  const active = () => profiles.requireActive();
  const recurrences = createRecurrenceService(db, active);
  const statements = createMonthlyStatementService(db, active);
  const months = createFinancialMonthService(db, active);
  const cards = createCreditCardService(db, active);
  const transactions = createTransactionService(db, active);
  const options = profiles.options();
  const method = (key: string) =>
    options.payments.find((row) => row.catalog_key === key)!.id;
  const input: RecurrenceCreateInput = {
    name: 'Salary estimate',
    type: 1,
    amount_cents: 300000,
    category_id: null,
    payment_id: method('pix'),
    credit_card_id: null,
    start_date: '2026-03-12',
    frequency: 3,
    interval: 1,
  };
  return {
    db,
    recurrences,
    statements,
    months,
    cards,
    transactions,
    input,
    method,
  };
}

test('monthly and cumulative estimates share a no-write financial snapshot in distant months', () => {
  const f = fixture();
  try {
    f.recurrences.create(f.input);
    const before = f.db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    const march = f.months.get('2026-03');
    assert.ok(march.statement);
    assert.equal(march.statement.income, 3000);
    assert.equal(march.statement.closingBalance, 3000);
    const may = f.months.get('2026-05');
    assert.ok(may.statement);
    assert.equal(may.statement.openingBalance, 6000);
    assert.equal(may.statement.closingBalance, 9000);
    assert.equal(may.recurrences.unconfirmed_count, 1);
    assert.equal(may.transactions.length, 0);
    assert.equal(may.statement.balanceSeries[10].balance, 6000);
    assert.equal(may.statement.balanceSeries[11].balance, 9000);
    const distant = f.months.get('2100-01');
    assert.ok(distant.statement);
    assert.equal(
      distant.statement.openingBalance,
      (2100 * 12 - (2026 * 12 + 2)) * 3000,
    );
    assert.equal(
      f.db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      before,
    );
  } finally {
    f.db.$client.close();
  }
});

test('confirmation moved into June replaces the May estimate once and invalidates later balances', () => {
  const f = fixture();
  try {
    const recurrence_id = f.recurrences.create(f.input);
    assert.equal(f.statements.get('2026-05').closingBalance, 9000);
    const slot = f.recurrences.month('2026-05').occurrences[0];
    const confirmation = {
      ...f.input,
      recurrence_id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      amount_cents: 350000,
      reference_date: '2026-06-02',
    };
    const transactionId = f.recurrences.confirm(confirmation);
    assert.equal(f.recurrences.confirm(confirmation), transactionId);
    const may = f.months.get('2026-05');
    assert.ok(may.statement);
    assert.equal(may.statement.income, 0);
    assert.equal(may.statement.closingBalance, 6000);
    assert.equal(may.recurrences.unconfirmed_count, 0);
    assert.equal(
      may.recurrences.occurrences[0].actual_reference_date,
      '2026-06-02',
    );
    assert.equal(may.recurrences.occurrences[0].cash_flow_date, '2026-06-02');
    const june = f.months.get('2026-06');
    assert.ok(june.statement);
    assert.equal(june.transactions.length, 1);
    assert.equal(june.statement.income, 6500);
    assert.equal(june.statement.closingBalance, 12500);
    f.transactions.remove(transactionId);
    assert.equal(
      f.recurrences.month('2026-05').occurrences[0].state,
      'ignored',
    );
    assert.equal(f.statements.get('2026-06').closingBalance, 9000);
    f.recurrences.restore({
      recurrence_id,
      scheduled_date: slot.scheduled_date,
    });
    assert.equal(f.statements.get('2026-06').closingBalance, 12000);
  } finally {
    f.db.$client.close();
  }
});

test('weekly cash flow uses actual dates while annual empty months carry balances', () => {
  const f = fixture();
  try {
    f.recurrences.create({
      ...f.input,
      type: 2,
      amount_cents: 1000,
      frequency: 2,
      start_date: '2026-03-02',
    });
    assert.equal(f.statements.get('2026-03').expense, 50);
    assert.equal(f.statements.get('2026-04').expense, 40);
    f.recurrences.create({
      ...f.input,
      amount_cents: 120000,
      frequency: 4,
      start_date: '2026-12-31',
    });
    const december = f.statements.get('2026-12');
    const january = f.statements.get('2027-01');
    assert.equal(december.income, 1200);
    assert.equal(january.income, 0);
    assert.equal(january.openingBalance, december.closingBalance);
  } finally {
    f.db.$client.close();
  }
});

test('version boundaries, inclusive pause and resumed gaps preserve cumulative estimates', () => {
  const f = fixture();
  try {
    const recurrence_id = f.recurrences.create(f.input);
    const slot = f.recurrences.month('2026-05').occurrences[0];
    f.recurrences.update({
      ...f.input,
      recurrence_id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      amount_cents: 400000,
    });
    assert.equal(f.statements.get('2026-04').income, 3000);
    assert.equal(f.statements.get('2026-05').income, 4000);
    f.recurrences.boundary({
      recurrence_id,
      action: 'pause',
      last_retained_date: '2026-05-12',
    });
    assert.equal(f.statements.get('2026-07').openingBalance, 10000);
    f.recurrences.resume({ recurrence_id, first_date: '2026-08-12' });
    assert.equal(f.statements.get('2026-07').income, 0);
    assert.equal(f.statements.get('2026-08').income, 4000);
    assert.equal(f.statements.get('2026-08').closingBalance, 14000);
  } finally {
    f.db.$client.close();
  }
});

test('credit projections use due dates without invoices and a PIX confirmation replaces them', () => {
  const f = fixture();
  try {
    const credit_card_id = f.cards.create({
      name: 'Projected card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    const defaults = {
      ...f.input,
      type: 2 as const,
      amount_cents: 10000,
      payment_id: f.method('credit'),
      credit_card_id,
      start_date: '2026-03-25',
    };
    const recurrence_id = f.recurrences.create(defaults);
    const before = f.db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    assert.equal(f.statements.get('2026-03').expense, 0);
    assert.equal(f.statements.get('2026-04').expense, 100);
    assert.equal(f.cards.invoices(credit_card_id).length, 0);
    assert.equal(
      f.db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      before,
    );
    const slot = f.recurrences.month('2026-03').occurrences[0];
    f.recurrences.confirm({
      ...defaults,
      recurrence_id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      reference_date: '2026-03-25',
      payment_id: f.method('pix'),
      credit_card_id: null,
      amount_cents: 12000,
    });
    assert.equal(f.statements.get('2026-03').expense, 120);
    assert.equal(f.statements.get('2026-04').expense, 0);
    assert.equal(f.statements.get('2026-04').openingBalance, -120);
  } finally {
    f.db.$client.close();
  }
});

test('authoritative invoice coverage remains explicit and unavailable totals can be reconciled', () => {
  const f = fixture();
  try {
    const credit_card_id = f.cards.create({
      name: 'Statement card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    const period = f.cards.previewPeriod(credit_card_id, '2026-03');
    const credit_card_invoice_id = f.cards.registerInvoice(credit_card_id, {
      ...period,
      total_source: 'statement',
      amount_cents: 50000,
    });
    const recurrence_id = f.recurrences.create({
      ...f.input,
      type: 2,
      amount_cents: 10000,
      payment_id: f.method('credit'),
      credit_card_id,
      frequency: 4,
    });
    const before = f.db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    const unresolved = f.months.get('2026-03');
    assert.equal(unresolved.statement, null);
    assert.match(unresolved.statement_issue!, /coverage/);
    assert.equal(unresolved.recurrences.occurrences[0].coverage, 'unknown');
    assert.equal(
      f.db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      before,
    );
    const coverage = {
      recurrence_id,
      scheduled_date: '2026-03-12',
      credit_card_invoice_id,
    };
    f.recurrences.coverage({ ...coverage, status: 'included' });
    assert.equal(f.months.get('2026-03').statement!.expense, 500);
    assert.equal(
      f.recurrences.month('2026-03').occurrences[0].state,
      'unconfirmed',
    );
    f.recurrences.coverage({ ...coverage, status: 'excluded' });
    assert.equal(f.statements.get('2026-03').expense, 600);
    f.db.run(
      sql`UPDATE credit_card_invoice SET paid_at='2026-03-27' WHERE id=${credit_card_invoice_id}`,
    );
    const paid = f.months.get('2026-04');
    assert.equal(paid.statement, null);
    assert.match(paid.statement_issue!, /correction_required/);
    f.recurrences.coverage({ ...coverage, status: 'included' });
    assert.equal(f.statements.get('2026-04').openingBalance, -500);
    assert.equal(
      f.cards.details(credit_card_invoice_id).invoice.amount_cents,
      50000,
    );
  } finally {
    f.db.$client.close();
  }
});

test('credit confirmation replaces the estimate once and settlement moves only the invoice cash flow', () => {
  const f = fixture();
  try {
    const credit_card_id = f.cards.create({
      name: 'Replacement card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const defaults = {
      ...f.input,
      type: 2 as const,
      amount_cents: 10000,
      payment_id: f.method('credit'),
      credit_card_id,
      frequency: 4 as const,
    };
    const recurrence_id = f.recurrences.create(defaults);
    assert.equal(f.statements.get('2026-04').expense, 100);
    const slot = f.recurrences.month('2026-03').occurrences[0];
    const purchase = {
      ...defaults,
      user_id: f.db.get<{ id: number }>(sql`SELECT id FROM user`)!.id,
      amount_cents: 12000,
      reference_date: slot.scheduled_date,
      payment_date: null,
      card_id: credit_card_id,
    };
    const plan = f.transactions.previewCreate(purchase)!;
    const confirmation = {
      ...purchase,
      recurrence_id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      correction_token: plan.token,
    };
    const id = f.recurrences.confirm(confirmation);
    assert.equal(f.recurrences.confirm(confirmation), id);
    const transaction = f.transactions.get(id);
    assert.equal(transaction.payment_date, null);
    assert.equal(f.transactions.list('2026-03').length, 1);
    assert.equal(f.recurrences.month('2026-03').unconfirmed_count, 0);
    assert.deepEqual(
      f.recurrences.getCashFlow('2026-04-01', '2026-05-01').days,
      [],
    );
    assert.equal(f.statements.get('2026-04').expense, 120);
    assert.equal(f.statements.get('2026-04').closingBalance, -120);

    for (const paid_at of ['2026-02-28', '2026-03-28']) {
      f.db.run(sql`UPDATE credit_card_invoice SET paid_at=${paid_at}
        WHERE id=${transaction.credit_card_invoice_id}`);
      const paidMonth = paid_at.slice(0, 7);
      assert.equal(f.statements.get(paidMonth).expense, 120);
      assert.equal(f.statements.get('2026-04').expense, 0);
      assert.equal(f.statements.get('2026-04').openingBalance, -120);
      assert.equal(f.statements.get('2026-04').closingBalance, -120);
      assert.equal(
        f.recurrences.month('2026-03').occurrences[0].cash_flow_date,
        paid_at,
      );
    }
  } finally {
    f.db.$client.close();
  }
});

test('confirmation into an already paid statement preserves its total and removes coverage ambiguity', () => {
  for (const paid_at of ['2026-02-28', '2026-03-28']) {
    const f = fixture();
    try {
      const credit_card_id = f.cards.create({
        name: 'Paid statement card',
        closing_day: 20,
        includes_closing_day: true,
        due_days_after_closing: 15,
      });
      const credit_card_invoice_id = f.cards.registerInvoice(credit_card_id, {
        ...f.cards.previewPeriod(credit_card_id, '2026-03'),
        total_source: 'statement',
        amount_cents: 30000,
      });
      f.db.run(sql`UPDATE credit_card_invoice SET paid_at=${paid_at}
        WHERE id=${credit_card_invoice_id}`);
      const defaults = {
        ...f.input,
        type: 2 as const,
        amount_cents: 10000,
        payment_id: f.method('credit'),
        credit_card_id,
        frequency: 4 as const,
      };
      const recurrence_id = f.recurrences.create(defaults);
      const slot = f.recurrences.month('2026-03').occurrences[0];
      assert.equal(slot.coverage, 'unknown');
      const purchase = {
        ...defaults,
        user_id: f.db.get<{ id: number }>(sql`SELECT id FROM user`)!.id,
        amount_cents: 12000,
        reference_date: slot.scheduled_date,
        payment_date: null,
        card_id: credit_card_id,
        credit_card_invoice_id,
      };
      const plan = f.transactions.previewCreate(purchase)!;
      const confirmation = {
        ...purchase,
        recurrence_id,
        scheduled_date: slot.scheduled_date,
        expected_version_id: slot.version_id,
        correction_token: plan.token,
      };
      const id = f.recurrences.confirm(confirmation);
      assert.equal(f.recurrences.confirm(confirmation), id);
      assert.equal(f.transactions.list('2026-03').length, 1);
      assert.equal(f.recurrences.month('2026-03').unconfirmed_count, 0);
      assert.equal(f.transactions.get(id).payment_date, null);
      const paid = f.months.get(paid_at.slice(0, 7));
      assert.equal(paid.statement_issue, null);
      assert.equal(paid.statement!.expense, 300);
      const april = f.months.get('2026-04');
      assert.equal(april.statement_issue, null);
      assert.equal(april.statement!.expense, 0);
      assert.equal(april.statement!.openingBalance, -300);
      assert.equal(april.statement!.closingBalance, -300);
      assert.equal(
        f.cards.details(credit_card_invoice_id).invoice.amount_cents,
        30000,
      );
    } finally {
      f.db.$client.close();
    }
  }
});

test('cumulative recurrence estimates reject integer-cent overflow before publishing totals', () => {
  const f = fixture();
  try {
    f.recurrences.create({ ...f.input, amount_cents: Number.MAX_SAFE_INTEGER });
    assert.throws(() => f.months.get('2026-05'), /overflow|supported amount/);
  } finally {
    f.db.$client.close();
  }
});

test('lifecycle preview identifies confirmed future transactions without changing history', () => {
  const f = fixture();
  try {
    const recurrence_id = f.recurrences.create(f.input);
    const slot = f.recurrences.month('2026-06').occurrences[0];
    const id = f.recurrences.confirm({
      ...f.input,
      recurrence_id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      reference_date: '2026-07-01',
    });
    const userId = f.db.get<{ id: number }>(sql`SELECT id FROM user`)!.id;
    const changes = f.db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    const input = { recurrence_id, last_retained_date: '2026-05-12' };
    const preview = previewRecurrenceBoundary(f.db, userId, input);
    assert.equal(preview.first_removed_date, '2026-06-12');
    assert.deepEqual(preview.confirmed_transactions, [
      {
        id,
        name: f.input.name,
        scheduled_date: '2026-06-12',
        reference_date: '2026-07-01',
        amount_cents: f.input.amount_cents,
      },
    ]);
    assert.equal(
      f.db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      changes,
    );
    assert.throws(
      () => previewRecurrenceBoundary(f.db, userId + 1, input),
      /not_found/,
    );
    f.recurrences.boundary({ ...input, action: 'end' });
    assert.equal(f.statements.get('2026-07').income, 3000);
    assert.equal(
      f.recurrences.month('2026-06').occurrences[0].transaction_id,
      id,
    );
  } finally {
    f.db.$client.close();
  }
});
