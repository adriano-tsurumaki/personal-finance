import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createRecurrenceService } from '../recurrences';
import { createTransactionService } from '../transactions';
import { createCreditCardService } from '../credit-cards';
import {
  transactionsTable,
  recurrenceOccurrencesTable,
  creditCardInvoicesTable,
  cardHistoryTable,
} from './schema';

function fixture() {
  const db = initDb(':memory:', resolve('drizzle'));
  const profiles = createProfileService(db);
  profiles.create({
    name: 'Rule owner',
    email: 'rule@example.test',
    locale: 'en-US',
  });
  const owner = () => profiles.requireActive();
  const recurrence = createRecurrenceService(db, owner);
  const transactions = createTransactionService(db, owner);
  const cards = createCreditCardService(db, owner);
  const input = {
    name: 'Subscription',
    type: 2 as const,
    amount_cents: 10000,
    category_id: profiles
      .options()
      .categories.find((c) => c.catalog_key === 'other')!.id,
    payment_id: profiles
      .options()
      .payments.find((p) => p.catalog_key === 'pix')!.id,
    credit_card_id: null as number | null,
    frequency: 3 as const,
    interval: 1,
    start_date: '2026-03-12',
  };
  return { db, profiles, recurrence, transactions, cards, input };
}

test('distant reads stay sparse and historical count math agrees with exceptions', () => {
  const { db, recurrence, input } = fixture();
  const id = recurrence.create(input);
  recurrence.ignore({ recurrence_id: id, scheduled_date: '2026-04-12' });
  const writes = db.get<{ n: number }>(sql`select total_changes() as n`)!.n;
  const cash = recurrence.getCashFlow('2036-03-01', '2036-04-01');
  assert.equal(cash.openingExpenseCents, 119 * 10000);
  assert.deepEqual(cash.days, [
    { date: '2036-03-12', incomeCents: 0, expenseCents: 10000 },
  ]);
  assert.equal(recurrence.month('2036-03').unconfirmed_count, 1);
  assert.equal(
    db.get<{ n: number }>(sql`select total_changes() as n`)!.n,
    writes,
  );
  assert.equal(db.select().from(transactionsTable).all().length, 0);
  recurrence.restore({ recurrence_id: id, scheduled_date: '2026-04-12' });
  assert.equal(
    recurrence.getCashFlow('2036-03-01', '2036-04-01').openingExpenseCents,
    120 * 10000,
  );
});

test('confirmation is atomic and idempotent; moved edits and deletion retain the slot', () => {
  const { db, recurrence, transactions, input } = fixture();
  const id = recurrence.create(input);
  const slot = recurrence.month('2026-05').occurrences[0];
  const confirmation = {
    ...input,
    recurrence_id: id,
    scheduled_date: slot.scheduled_date,
    expected_version_id: slot.version_id,
    reference_date: '2026-06-03',
    name: 'Actual charge',
    amount_cents: 12500,
  };
  assert.throws(() =>
    recurrence.confirm({ ...confirmation, amount_cents: -1 }),
  );
  assert.equal(db.select().from(transactionsTable).all().length, 0);
  assert.equal(db.select().from(recurrenceOccurrencesTable).all().length, 0);
  const transaction = recurrence.confirm(confirmation);
  assert.equal(recurrence.confirm(confirmation), transaction);
  const confirmed = recurrence.month('2026-05').occurrences[0];
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.amount_cents, 12500);
  assert.equal(confirmed.name, 'Actual charge');
  assert.equal(confirmed.actual_reference_date, '2026-06-03');
  transactions.update(transaction, {
    name: 'Changed',
    type: 2,
    amount_cents: 14000,
    reference_date: '2026-07-01',
  });
  assert.equal(
    recurrence.month('2026-05').occurrences[0].actual_reference_date,
    '2026-07-01',
  );
  transactions.remove(transaction);
  assert.equal(recurrence.month('2026-05').occurrences[0].state, 'ignored');
  assert.equal(recurrence.month('2026-05').unconfirmed_count, 0);
  recurrence.restore({ recurrence_id: id, scheduled_date: '2026-05-12' });
  assert.equal(recurrence.month('2026-05').unconfirmed_count, 1);
});

test('version changes preserve cadence, detect stale inputs, and keep confirmed actuals', () => {
  const { recurrence, input } = fixture();
  const id = recurrence.create(input);
  const first = recurrence.month('2026-03').occurrences[0];
  recurrence.confirm({
    ...input,
    recurrence_id: id,
    scheduled_date: first.scheduled_date,
    expected_version_id: first.version_id,
    reference_date: first.scheduled_date,
  });
  recurrence.update({
    ...input,
    recurrence_id: id,
    scheduled_date: first.scheduled_date,
    expected_version_id: first.version_id,
    amount_cents: 20000,
  });
  assert.throws(() =>
    recurrence.update({
      ...input,
      recurrence_id: id,
      scheduled_date: first.scheduled_date,
      expected_version_id: first.version_id,
    }),
  );
  assert.equal(recurrence.month('2026-03').occurrences[0].amount_cents, 10000);
  assert.equal(recurrence.month('2026-04').occurrences[0].amount_cents, 20000);
  assert.equal(
    recurrence.month('2026-04').occurrences[0].scheduled_date,
    '2026-04-12',
  );
});

test('inclusive pause preserves future confirmations, resume leaves a gap and end cannot resume', () => {
  const { recurrence, input } = fixture();
  const id = recurrence.create(input);
  const june = recurrence.month('2026-06').occurrences[0];
  recurrence.confirm({
    ...input,
    recurrence_id: id,
    scheduled_date: june.scheduled_date,
    expected_version_id: june.version_id,
    reference_date: june.scheduled_date,
  });
  recurrence.boundary({
    recurrence_id: id,
    last_retained_date: '2026-05-12',
    action: 'pause',
  });
  assert.equal(recurrence.month('2026-05').unconfirmed_count, 1);
  assert.equal(recurrence.month('2026-06').occurrences[0].state, 'confirmed');
  assert.equal(recurrence.month('2026-07').paused_rules.length, 1);
  recurrence.resume({ recurrence_id: id, first_date: '2026-08-12' });
  assert.equal(recurrence.month('2026-07').occurrences.length, 0);
  assert.equal(recurrence.month('2026-08').unconfirmed_count, 1);
  recurrence.boundary({
    recurrence_id: id,
    last_retained_date: '2026-08-12',
    action: 'end',
  });
  assert.equal(recurrence.month('2026-09').occurrences.length, 0);
  assert.throws(() =>
    recurrence.resume({ recurrence_id: id, first_date: '2026-10-12' }),
  );
});

test('paused rules allow retained default edits and occurrence decisions without filling the gap', () => {
  const { recurrence, input } = fixture();
  const id = recurrence.create(input);
  const first = recurrence.month('2026-03').occurrences[0];
  const confirmedId = recurrence.confirm({
    ...input,
    recurrence_id: id,
    scheduled_date: first.scheduled_date,
    expected_version_id: first.version_id,
    reference_date: first.scheduled_date,
  });
  recurrence.boundary({
    recurrence_id: id,
    last_retained_date: '2026-05-12',
    action: 'pause',
  });
  recurrence.update({
    ...input,
    recurrence_id: id,
    scheduled_date: '2026-04-12',
    expected_version_id: first.version_id,
    amount_cents: 15000,
  });
  const april = recurrence.month('2026-04').occurrences[0];
  assert.equal(april.amount_cents, 15000);
  recurrence.ignore(april);
  assert.equal(recurrence.month('2026-04').occurrences[0].state, 'ignored');
  recurrence.restore(april);
  assert.equal(recurrence.month('2026-04').unconfirmed_count, 1);
  recurrence.confirm({
    ...input,
    ...april,
    expected_version_id: april.version_id,
    reference_date: april.scheduled_date,
    amount_cents: 17500,
  });
  assert.equal(recurrence.month('2026-04').occurrences[0].amount_cents, 17500);
  assert.equal(recurrence.month('2026-05').occurrences[0].amount_cents, 15000);
  assert.equal(
    recurrence.month('2026-03').occurrences[0].transaction_id,
    confirmedId,
  );
  assert.equal(recurrence.month('2026-03').occurrences[0].amount_cents, 10000);
  assert.equal(recurrence.list()[0].status, 'paused');
  assert.equal(recurrence.list()[0].last_retained_date, '2026-05-12');
  assert.equal(recurrence.month('2026-06').occurrences.length, 0);
  assert.throws(() =>
    recurrence.ignore({ recurrence_id: id, scheduled_date: '2026-06-12' }),
  );
  recurrence.resume({ recurrence_id: id, first_date: '2026-08-12' });
  assert.equal(recurrence.month('2026-07').occurrences.length, 0);
  assert.equal(recurrence.month('2026-08').occurrences[0].amount_cents, 15000);
});

test('credit previews are read-only and authoritative invoice coverage is explicit', () => {
  const { db, recurrence, cards, input } = fixture();
  const card = cards.create({
    name: 'Everyday',
    closing_day: 20,
    includes_closing_day: true,
    due_days_after_closing: 15,
  });
  const credit = {
    ...input,
    payment_id: db.get<{ id: number }>(
      sql`select id from payments where catalog_key='credit'`,
    )!.id,
    credit_card_id: card,
  };
  const id = recurrence.create(credit);
  const writes = db.get<{ n: number }>(sql`select total_changes() as n`)!.n;
  const projected = recurrence.month('2026-03').occurrences[0];
  assert.equal(projected.cash_flow_date, '2026-04-04');
  assert.equal(db.select().from(creditCardInvoicesTable).all().length, 0);
  assert.equal(db.select().from(cardHistoryTable).all().length, 1);
  assert.equal(
    db.get<{ n: number }>(sql`select total_changes() as n`)!.n,
    writes,
  );
  assert.deepEqual(recurrence.getCashFlow('2026-04-01', '2026-05-01').days, [
    { date: '2026-04-04', incomeCents: 0, expenseCents: 10000 },
  ]);
  const invoice = db
    .insert(creditCardInvoicesTable)
    .values({
      credit_card_id: card,
      opening_date: '2026-02-21',
      closing_date: '2026-03-20',
      due_date: '2026-04-04',
      includes_closing_day: true,
      total_source: 'statement',
      amount_cents: 30000,
    })
    .returning()
    .get()!;
  assert.equal(recurrence.month('2026-03').occurrences[0].coverage, 'unknown');
  assert.throws(
    () => recurrence.getCashFlow('2026-04-01', '2026-05-01'),
    /coverage/,
  );
  recurrence.coverage({
    recurrence_id: id,
    scheduled_date: '2026-03-12',
    credit_card_invoice_id: invoice.id,
    status: 'included',
  });
  assert.equal(
    recurrence.getCashFlow('2026-04-01', '2026-05-01').days.length,
    0,
  );
  recurrence.coverage({
    recurrence_id: id,
    scheduled_date: '2026-03-12',
    credit_card_invoice_id: invoice.id,
    status: 'excluded',
  });
  assert.equal(
    recurrence.getCashFlow('2026-04-01', '2026-05-01').days[0].expenseCents,
    10000,
  );
  db.update(creditCardInvoicesTable)
    .set({ paid_at: '2026-04-02' })
    .where(eq(creditCardInvoicesTable.id, invoice.id))
    .run();
  assert.throws(
    () => recurrence.getCashFlow('2026-04-01', '2026-05-01'),
    /correction_required/,
  );
});

test('profile ownership guards all recurrence mutations and queries', () => {
  const { profiles, recurrence, input } = fixture();
  const id = recurrence.create(input);
  profiles.create({
    name: 'Another',
    email: 'other@example.test',
    locale: 'en-US',
  });
  assert.equal(recurrence.list().length, 0);
  assert.equal(recurrence.month('2026-03').occurrences.length, 0);
  assert.throws(() =>
    recurrence.ignore({ recurrence_id: id, scheduled_date: '2026-03-12' }),
  );
});

test('incomplete legacy rules require explicit dismissal and retain all historical links', () => {
  const { db, recurrence, profiles } = fixture();
  const row = db.get<{ id: number }>(
    sql`insert into recurrences(name,user_id,status,active) values ('Legacy',${profiles.requireActive().id},'repair_required',1) returning id`,
  )!;
  assert.throws(
    () => recurrence.getCashFlow('2026-03-01', '2026-04-01'),
    /repair_required/,
  );
  recurrence.dismissLegacy(row.id);
  assert.equal(recurrence.list()[0].status, 'ended');
  assert.deepEqual(recurrence.getCashFlow('2026-03-01', '2026-04-01'), {
    openingIncomeCents: 0,
    openingExpenseCents: 0,
    events: [],
    days: [],
  });
  assert.throws(() => recurrence.dismissLegacy(row.id), /lifecycle_conflict/);
});

test('credit aggregation matches enumerated cash flow across sparse overrides and decisions', () => {
  const { db, recurrence, cards, input } = fixture();
  const card = cards.create({
    name: 'Long lived',
    closing_day: 20,
    includes_closing_day: true,
    due_days_after_closing: 15,
  });
  const id = recurrence.create({
    ...input,
    start_date: '2010-01-12',
    frequency: 2,
    interval: 1,
    payment_id: db.get<{ id: number }>(
      sql`select id from payments where catalog_key='credit'`,
    )!.id,
    credit_card_id: card,
  });
  recurrence.ignore({ recurrence_id: id, scheduled_date: '2010-01-19' });
  db.insert(creditCardInvoicesTable)
    .values({
      credit_card_id: card,
      opening_date: '2010-12-21',
      closing_date: '2011-01-20',
      due_date: '2011-03-25',
      includes_closing_day: true,
      total_source: 'calculated',
      amount_cents: 0,
    })
    .run();
  const entries = recurrence
    .forecast('2010-01-01', '2011-05-01')
    .filter((o) => o.state === 'unconfirmed');
  for (const month of ['2011-01', '2011-02', '2011-03', '2011-04']) {
    const start = `${month}-01`;
    const end =
      month === '2011-04'
        ? '2011-05-01'
        : `2011-${String(Number(month.slice(5)) + 1).padStart(2, '0')}-01`;
    const expectedOpening = entries
      .filter((o) => o.cash_flow_date && o.cash_flow_date < start)
      .reduce((total, o) => total + o.amount_cents, 0);
    const expectedMonth = entries
      .filter(
        (o) =>
          o.cash_flow_date &&
          o.cash_flow_date >= start &&
          o.cash_flow_date < end,
      )
      .reduce((total, o) => total + o.amount_cents, 0);
    const result = recurrence.getCashFlow(start, end);
    assert.equal(result.openingExpenseCents, expectedOpening, month);
    assert.equal(
      result.days.reduce((total, d) => total + d.expenseCents, 0),
      expectedMonth,
      month,
    );
  }
});

test('default edits reject calendar and type changes without writes', () => {
  const { db, recurrence, input } = fixture();
  const id = recurrence.create(input);
  const occurrence = recurrence.month('2026-03').occurrences[0];
  const update = {
    ...input,
    recurrence_id: id,
    scheduled_date: occurrence.scheduled_date,
    expected_version_id: occurrence.version_id,
  };
  const before = recurrence.list();
  const writes = db.get<{ n: number }>(sql`select total_changes() as n`)!.n;
  for (const change of [
    { frequency: 2 },
    { interval: 2 },
    { start_date: '2026-04-12' },
    { anchor_date: '2026-03-13' },
    { type: 1 },
  ]) {
    assert.throws(
      () => recurrence.update({ ...update, ...change } as typeof update),
      /invalid_recurrence_calendar_or_type_change/,
    );
  }
  assert.deepEqual(recurrence.list(), before);
  assert.equal(
    db.get<{ n: number }>(sql`select total_changes() as n`)!.n,
    writes,
  );
  recurrence.update({
    ...update,
    frequency: 3,
    interval: 1,
    anchor_date: input.start_date,
    amount_cents: 11000,
  } as typeof update);
  assert.equal(recurrence.month('2026-04').occurrences[0].amount_cents, 11000);
});

test('earlier default edits supersede future defaults without changing confirmed history or paused gaps', () => {
  const { recurrence, input } = fixture();
  const id = recurrence.create(input);
  const first = recurrence.month('2026-03').occurrences[0];
  recurrence.update({
    ...input,
    recurrence_id: id,
    scheduled_date: '2026-05-12',
    expected_version_id: first.version_id,
    amount_cents: 20000,
  });
  const may = recurrence.month('2026-05').occurrences[0];
  recurrence.confirm({
    ...input,
    recurrence_id: id,
    scheduled_date: may.scheduled_date,
    expected_version_id: may.version_id,
    reference_date: may.scheduled_date,
    amount_cents: 22000,
  });
  recurrence.boundary({
    recurrence_id: id,
    last_retained_date: '2026-06-12',
    action: 'pause',
  });
  recurrence.resume({ recurrence_id: id, first_date: '2026-09-12' });
  recurrence.update({
    ...input,
    recurrence_id: id,
    scheduled_date: '2026-04-12',
    expected_version_id: first.version_id,
    amount_cents: 30000,
  });
  assert.equal(recurrence.month('2026-03').occurrences[0].amount_cents, 10000);
  assert.equal(recurrence.month('2026-04').occurrences[0].amount_cents, 30000);
  assert.equal(recurrence.month('2026-05').occurrences[0].amount_cents, 22000);
  assert.equal(recurrence.month('2026-06').occurrences[0].amount_cents, 30000);
  assert.equal(recurrence.month('2026-07').occurrences.length, 0);
  assert.equal(recurrence.month('2026-08').occurrences.length, 0);
  assert.equal(recurrence.month('2026-09').occurrences[0].amount_cents, 30000);
  assert.equal(recurrence.month('2027-01').occurrences[0].amount_cents, 30000);
});
