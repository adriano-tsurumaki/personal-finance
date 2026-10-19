import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, readdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createCreditCardService } from '../credit-cards';
import { createTransactionService } from '../transactions';
import { createMonthlyStatementService } from '../monthly-statement';
import { createFinancialMonthService } from '../financial-month';
import {
  creditCardInvoicesTable,
  creditCardsTable,
  cardHistoryTable,
  paymentsTable,
  transactionsTable,
} from './schema';
import {
  adjacentMonth,
  addCalendarDays,
  periodForMonth,
} from '../credit-cards/billing-cycle';
import type { TransactionInput } from '@shared/contracts/transaction';
import type { InvoiceInput } from '@shared/contracts/credit-cards';

const migrations = resolve('drizzle');
function fixture(filename = ':memory:') {
  const db = initDb(filename, migrations);
  const profiles = createProfileService(db);
  const profile = profiles.create({
    name: 'Card owner',
    email: 'cards@example.test',
    locale: 'en-US',
  });
  assert.ok(profile.ok);
  const cards = createCreditCardService(db, () => profiles.requireActive());
  const transactions = createTransactionService(db, () =>
    profiles.requireActive(),
  );
  const statements = createMonthlyStatementService(db, () =>
    profiles.requireActive(),
  );
  const cardId = cards.create({
    name: 'Everyday',
    closing_day: 20,
    includes_closing_day: true,
    due_days_after_closing: 7,
  });
  const input: TransactionInput = {
    name: 'Purchase',
    type: 2,
    amount_cents: 10000,
    note: null,
    payment_date: null,
    reference_date: '2026-10-20',
    user_id: 999,
    payment_id: profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id,
    category_id: profiles
      .options()
      .categories.find((row) => row.catalog_key === 'food')!.id,
    card_id: cardId,
  };
  function purchase(overrides: Partial<TransactionInput> = {}) {
    const value = { ...input, ...overrides };
    const plan = transactions.previewCreate(value)!;
    transactions.create({ ...value, correction_token: plan.token });
    return db
      .select()
      .from(transactionsTable)
      .orderBy(sql`${transactionsTable.id} DESC`)
      .get()!;
  }
  return {
    db,
    profiles,
    profile: profile.profile,
    cards,
    transactions,
    statements,
    cardId,
    input,
    purchase,
  };
}

test('billing dates handle inclusion, short months, leap centuries and date rollover', () => {
  const settings = {
    closing_day: 31,
    includes_closing_day: true,
    due_days_after_closing: 7,
  };
  assert.deepEqual(periodForMonth(settings, '2027-02'), {
    opening_date: '2027-02-01',
    closing_date: '2027-02-28',
    due_date: '2027-03-07',
    includes_closing_day: true,
  });
  assert.equal(periodForMonth(settings, '2028-02').closing_date, '2028-02-29');
  assert.equal(periodForMonth(settings, '1900-02').closing_date, '1900-02-28');
  assert.equal(periodForMonth(settings, '2000-02').closing_date, '2000-02-29');
  assert.equal(periodForMonth(settings, '0099-02').closing_date, '0099-02-28');
  assert.equal(addCalendarDays('2026-12-31', 7), '2027-01-07');
  assert.equal(adjacentMonth('2026-01', -1), '2025-12');
  assert.equal(
    periodForMonth(
      { ...settings, closing_day: 20, includes_closing_day: false },
      '2026-10',
    ).opening_date,
    '2026-09-20',
  );
  assert.throws(() => addCalendarDays('2026-02-30', 1));
  assert.throws(() => addCalendarDays('9999-12-31', 1));
  const f = fixture();
  try {
    const id = f.cards.create({
      name: 'Absolute offset',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 1000,
    });
    assert.equal(f.cards.previewPeriod(id, '2024-10').due_date, '2027-07-17');
  } finally {
    f.db.$client.close();
  }
});

test('purchase previews leave no rows, create once, preserve dates and reconcile edits/deletions', () => {
  const f = fixture();
  try {
    const initialHistory = f.db.select().from(cardHistoryTable).all().length;
    const plan = f.transactions.previewCreate(f.input)!;
    assert.equal(f.cards.invoices(f.cardId).length, 0);
    assert.equal(f.db.select().from(transactionsTable).all().length, 0);
    assert.equal(
      f.db.select().from(cardHistoryTable).all().length,
      initialHistory,
    );
    f.transactions.create({ ...f.input, correction_token: plan.token });
    const first = f.transactions.list('2026-10')[0];
    const invoiceId = first.credit_card_invoice_id!;
    assert.equal(f.cards.details(invoiceId).invoice.amount_cents, 10000);
    f.purchase({ name: 'Second', amount_cents: 2500 });
    assert.equal(f.cards.invoices(f.cardId).length, 1);
    assert.equal(f.cards.details(invoiceId).invoice.amount_cents, 12500);
    const changed = {
      ...f.input,
      reference_date: '2024-05-02',
      amount_cents: 11000,
    };
    const correction = f.transactions.previewUpdate(first.id, changed);
    assert.throws(
      () => f.transactions.update(first.id, changed),
      /stale_correction/,
    );
    f.transactions.update(first.id, {
      ...changed,
      correction_token: correction.token,
    });
    assert.equal(f.transactions.get(first.id).reference_date, '2024-05-02');
    assert.equal(
      f.transactions.get(first.id).credit_card_invoice_id,
      invoiceId,
    );
    assert.equal(f.cards.details(invoiceId).invoice.amount_cents, 13500);
    const removal = f.transactions.previewRemove(first.id);
    f.transactions.remove(first.id, removal.token);
    assert.equal(f.cards.details(invoiceId).invoice.amount_cents, 2500);
    assert.ok(
      f.cards
        .details(invoiceId)
        .history.some(
          (row) =>
            row.operation === 'delete_purchase' &&
            row.changes.some(
              (change) =>
                change.before?.reference_date === '2024-05-02' &&
                change.after === null,
            ),
        ),
    );
    assert.equal(f.statements.get('2026-10').expense, 25);
  } finally {
    f.db.$client.close();
  }
});

test('monthly summaries include unpaid invoices by due month and count settlement once', () => {
  const f = fixture();

  try {
    // A purchase after closing belongs to the next invoice, not its timeline month.
    assert.equal(f.statements.get('2026-11').expense, 0);
    const first = f.purchase({ reference_date: '2026-10-21' });
    const invoiceId = first.credit_card_invoice_id!;
    assert.equal(f.cards.details(invoiceId).invoice.due_date, '2026-11-27');
    assert.equal(f.cards.details(invoiceId).invoice.paid_at, null);
    assert.equal(f.statements.get('2026-10').expense, 0);
    const due = f.statements.get('2026-11');
    assert.equal(due.expense, 100);
    assert.equal(due.net, -100);
    assert.equal(due.closingBalance, -100);
    assert.equal(due.balanceSeries[25].balance, 0);
    assert.equal(due.balanceSeries[26].balance, -100);
    f.purchase({ reference_date: '2026-10-22', amount_cents: 2500 });
    assert.equal(f.statements.get('2026-11').expense, 125);

    const update = { ...f.input, amount_cents: 15000 };
    const plan = f.transactions.previewUpdate(first.id, update)!;
    f.transactions.update(first.id, {
      ...update,
      correction_token: plan.token,
    });
    assert.equal(f.statements.get('2026-11').expense, 175);
    const removal = f.transactions.previewRemove(first.id);
    f.transactions.remove(first.id, removal.token);
    assert.equal(f.statements.get('2026-11').expense, 25);
    const current = f.cards.details(invoiceId).invoice;
    const correction: InvoiceInput = {
      opening_date: current.opening_date!,
      closing_date: current.closing_date,
      due_date: '2026-12-01',
      includes_closing_day: current.includes_closing_day!,
      total_source: current.total_source,
      amount_cents: current.amount_cents,
    };
    const correctionPlan = f.cards.previewCorrection(invoiceId, correction);
    f.cards.correctInvoice(invoiceId, correction, correctionPlan.token);
    assert.equal(f.statements.get('2026-11').expense, 0);
    assert.equal(f.statements.get('2026-12').expense, 25);

    // An actual payment replaces the projected due-date event, including early payment.
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-11-30' })
      .where(eq(creditCardInvoicesTable.id, invoiceId))
      .run();
    assert.equal(f.statements.get('2026-11').expense, 25);
    assert.equal(f.statements.get('2026-12').expense, 0);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-12-01' })
      .where(eq(creditCardInvoicesTable.id, invoiceId))
      .run();
    assert.equal(f.statements.get('2026-11').expense, 0);
    assert.equal(f.statements.get('2026-12').expense, 25);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2027-01-02' })
      .where(eq(creditCardInvoicesTable.id, invoiceId))
      .run();
    assert.equal(f.statements.get('2026-12').expense, 0);
    assert.equal(f.statements.get('2027-01').expense, 25);
    const other = f.profiles.create({
      name: 'Other invoice owner',
      email: 'other-invoice-owner@example.test',
      locale: 'en-US',
    });
    assert.ok(other.ok);
    assert.equal(f.statements.get('2027-01').expense, 0);
    f.profiles.enter(f.profile.id);
    assert.equal(f.statements.get('2027-01').expense, 25);
  } finally {
    f.db.$client.close();
  }
});

test('closing overrides preview adjacent movement and reject stale correction plans', () => {
  const f = fixture();
  try {
    const first = f.purchase();
    f.purchase({ reference_date: '2026-10-21', amount_cents: 2500 });
    const invoice = f.cards.details(first.credit_card_invoice_id!).invoice;
    const input: InvoiceInput = {
      opening_date: invoice.opening_date!,
      closing_date: invoice.closing_date,
      due_date: invoice.due_date,
      includes_closing_day: false,
      total_source: 'calculated',
      amount_cents: 0,
    };
    const oldPlan = f.cards.previewCorrection(invoice.id, input);
    assert.equal(
      oldPlan.changes.filter((row) => row.entity === 'invoice').length,
      2,
    );
    assert.equal(
      oldPlan.changes.filter((row) => row.entity === 'transaction').length,
      1,
    );
    f.purchase({ reference_date: '2026-10-22', amount_cents: 700 });
    assert.throws(
      () => f.cards.correctInvoice(invoice.id, input, oldPlan.token),
      /stale_correction/,
    );
    assert.equal(
      f.cards.details(invoice.id).invoice.includes_closing_day,
      true,
    );
    const plan = f.cards.previewCorrection(invoice.id, input);
    f.cards.correctInvoice(invoice.id, input, plan.token);
    const moved = f.transactions.get(first.id);
    assert.notEqual(moved.credit_card_invoice_id, invoice.id);
    assert.equal(moved.reference_date, '2026-10-20');
    assert.equal(f.cards.details(invoice.id).invoice.amount_cents, 0);
    assert.equal(
      f.cards.details(moved.credit_card_invoice_id!).invoice.amount_cents,
      13200,
    );
    assert.equal(
      f.cards.details(moved.credit_card_invoice_id!).invoice.opening_date,
      '2026-10-20',
    );
    const next = f.purchase({ reference_date: '2026-11-21' });
    assert.notEqual(next.credit_card_invoice_id, moved.credit_card_invoice_id);
  } finally {
    f.db.$client.close();
  }
});

test('boundary corrections reject overlapping periods without changing purchases or history', () => {
  const f = fixture();
  try {
    const first = f.purchase();
    f.purchase({ reference_date: '2026-10-21', amount_cents: 2500 });
    const current = f.cards.details(first.credit_card_invoice_id!).invoice;
    const input: InvoiceInput = {
      opening_date: current.opening_date!,
      closing_date: '2026-11-25',
      due_date: '2026-12-02',
      includes_closing_day: true,
      total_source: 'calculated',
      amount_cents: 0,
    };
    const invoices = f.cards.invoices(f.cardId);
    const entries = f.db.select().from(transactionsTable).all();
    const history = f.db.select().from(cardHistoryTable).all();

    for (const includes_closing_day of [true, false]) {
      const proposal = { ...input, includes_closing_day };
      assert.throws(
        () => f.cards.previewCorrection(current.id, proposal),
        /ambiguous_invoice/,
      );
      assert.throws(
        () => f.cards.correctInvoice(current.id, proposal, 'unused'),
        /ambiguous_invoice/,
      );
    }

    const gapInvoice = f.cards.registerInvoice(f.cardId, {
      ...input,
      opening_date: '2026-12-10',
      closing_date: '2026-12-20',
      due_date: '2026-12-27',
    });
    assert.throws(
      () =>
        f.cards.previewCorrection(gapInvoice, {
          ...input,
          opening_date: '2026-11-01',
          closing_date: '2026-12-20',
          due_date: '2026-12-27',
        }),
      /ambiguous_invoice/,
    );
    assert.deepEqual(
      f.cards.invoices(f.cardId).filter((row) => row.id !== gapInvoice),
      invoices,
    );
    assert.deepEqual(f.db.select().from(transactionsTable).all(), entries);
    assert.deepEqual(
      f.db.select().from(cardHistoryTable).all().slice(0, history.length),
      history,
    );
    assert.equal(
      f.db.select().from(cardHistoryTable).all().length,
      history.length + 1,
    );
    assert.equal(
      f.cards.suggestPeriod(f.cardId, '2026-11-01').closing_date,
      '2026-11-20',
    );
  } finally {
    f.db.$client.close();
  }
});

test('linked legacy purchases retain their associations through previewed edits', () => {
  const f = fixture();
  try {
    const purchase = f.purchase();
    const method = f.db
      .insert(paymentsTable)
      .values({
        name: 'Legacy custom credit',
        type: 2,
      })
      .returning()
      .get()!;
    f.db
      .update(transactionsTable)
      .set({ payment_id: method.id })
      .where(eq(transactionsTable.id, purchase.id))
      .run();
    assert.equal(
      f.profiles.options().payments.some((row) => row.id === method.id),
      false,
    );
    const draft = f.transactions.get(purchase.id);
    assert.equal(draft.card_id, f.cardId);
    assert.equal(draft.credit_card_invoice_id, purchase.credit_card_invoice_id);
    const details = {
      ...draft,
      name: 'Corrected legacy purchase',
      amount_cents: 12500,
    };
    const preview = f.transactions.previewUpdate(purchase.id, details);
    f.transactions.update(purchase.id, {
      ...details,
      correction_token: preview.token,
    });
    const edited = f.transactions.get(purchase.id);
    assert.equal(edited.name, details.name);
    assert.equal(edited.payment_id, method.id);
    assert.equal(
      edited.credit_card_invoice_id,
      purchase.credit_card_invoice_id,
    );
    assert.equal(
      f.cards.details(purchase.credit_card_invoice_id!).invoice.amount_cents,
      12500,
    );
  } finally {
    f.db.$client.close();
  }
});

test('opening corrections preview previous invoice dates, moves and original snapshots', () => {
  const f = fixture();
  try {
    const previousEntry = f.purchase({ reference_date: '2026-09-20' });
    const entry = f.purchase({ reference_date: '2026-09-21' });
    const current = f.cards.details(entry.credit_card_invoice_id!).invoice;
    const input: InvoiceInput = {
      opening_date: '2026-09-22',
      closing_date: current.closing_date,
      due_date: current.due_date,
      includes_closing_day: true,
      total_source: 'calculated',
      amount_cents: 0,
    };
    const plan = f.cards.previewCorrection(current.id, input);
    const move = plan.changes.find(
      (change) => change.entity === 'transaction' && change.id === entry.id,
    )!;
    assert.equal(move.before!.credit_card_invoice_id, current.id);
    assert.equal(
      move.after!.credit_card_invoice_id,
      previousEntry.credit_card_invoice_id,
    );
    f.cards.correctInvoice(current.id, input, plan.token);
    assert.equal(
      f.cards.details(previousEntry.credit_card_invoice_id!).invoice
        .closing_date,
      '2026-09-21',
    );
    assert.equal(
      f.cards.details(previousEntry.credit_card_invoice_id!).invoice.due_date,
      '2026-09-28',
    );
    assert.equal(
      f.cards.details(previousEntry.credit_card_invoice_id!).invoice
        .amount_cents,
      20000,
    );
    assert.equal(f.cards.details(current.id).invoice.amount_cents, 0);
  } finally {
    f.db.$client.close();
  }
});

test('invoice corrections strip fields outside the contract and preserve settlement and ownership', () => {
  const f = fixture();
  try {
    const entry = f.purchase();
    const invoice = f.cards.details(entry.credit_card_invoice_id!).invoice;
    const input = {
      opening_date: invoice.opening_date!,
      closing_date: invoice.closing_date,
      due_date: invoice.due_date,
      includes_closing_day: true,
      total_source: 'statement' as const,
      amount_cents: 50000,
      paid_at: '2026-10-20',
      id: 999,
      credit_card_id: 999,
    };
    const plan = f.cards.previewCorrection(invoice.id, input);
    assert.equal(plan.changes[0].id, invoice.id);
    assert.equal(plan.changes[0].after!.paid_at, null);
    f.cards.correctInvoice(invoice.id, input, plan.token);
    assert.equal(f.cards.details(invoice.id).invoice.credit_card_id, f.cardId);
    assert.equal(f.cards.details(invoice.id).invoice.paid_at, null);
    const second = f.cards.registerInvoice(f.cardId, {
      ...input,
      closing_date: '2024-10-20',
      opening_date: '2024-09-21',
      due_date: '2024-10-27',
    });
    assert.notEqual(second, 999);
    assert.equal(f.cards.details(second).invoice.paid_at, null);
  } finally {
    f.db.$client.close();
  }
});

test('paid historical statement totals remain fixed while details are completed and corrections are audited', () => {
  const f = fixture();
  try {
    const historical = {
      opening_date: '2024-09-21',
      closing_date: '2024-10-20',
      due_date: '2024-10-27',
      includes_closing_day: true,
      total_source: 'statement' as const,
      amount_cents: 50000,
    };
    const id = f.cards.registerInvoice(f.cardId, historical);
    assert.equal(f.statements.get('2024-10').expense, 500);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2024-11-02' })
      .where(eq(creditCardInvoicesTable.id, id))
      .run();
    f.purchase({
      reference_date: '2024-10-10',
      credit_card_invoice_id: id,
      amount_cents: 30000,
    });
    assert.equal(f.cards.details(id).invoice.difference_cents, 20000);
    assert.equal(f.statements.get('2024-11').expense, 500);
    f.purchase({
      reference_date: '2024-10-11',
      credit_card_invoice_id: id,
      amount_cents: 10000,
    });
    assert.equal(f.cards.details(id).invoice.difference_cents, 10000);
    assert.equal(f.statements.get('2024-11').expense, 500);
    const correction = { ...historical, amount_cents: 55000 };
    const plan = f.cards.previewCorrection(id, correction);
    assert.deepEqual(plan.affected_payment_months, ['2024-11']);
    f.cards.correctInvoice(id, correction, plan.token);
    assert.equal(f.statements.get('2024-11').expense, 550);
    assert.equal(f.statements.get('2024-10').expense, 0);
    assert.equal(f.cards.details(id).invoice.paid_at, '2024-11-02');
    assert.ok(
      f.cards
        .details(id)
        .history.some((row) =>
          row.changes.some(
            (change) =>
              change.before?.amount_cents === 50000 &&
              change.after?.amount_cents === 55000,
          ),
        ),
    );
  } finally {
    f.db.$client.close();
  }
});

test('historical association isolates cards and profiles and allows archived cards explicitly', () => {
  const f = fixture();
  try {
    const entry = f.purchase();
    const second = f.cards.create({
      name: 'Archive',
      closing_day: 10,
      includes_closing_day: false,
      due_days_after_closing: 7,
    });
    const id = f.cards.registerInvoice(second, {
      opening_date: '2024-09-10',
      closing_date: '2024-10-10',
      due_date: '2024-10-17',
      includes_closing_day: false,
      total_source: 'calculated',
      amount_cents: 0,
    });
    const association = { card_id: second, invoice_id: id };
    const plan = f.cards.associate(entry.id, association);
    assert.throws(
      () => f.cards.associate(entry.id, association, 'wrong'),
      /stale_correction/,
    );
    f.cards.associate(entry.id, association, plan.token);
    assert.equal(f.cards.details(id).invoice.amount_cents, 10000);
    assert.equal(
      f.cards.details(entry.credit_card_invoice_id!).invoice.amount_cents,
      0,
    );
    f.cards.archive(second);
    assert.throws(
      () => f.purchase({ card_id: second, credit_card_invoice_id: id }),
      /archived_card/,
    );
    f.purchase({
      card_id: second,
      credit_card_invoice_id: id,
      historical_card: true,
    });
    const other = f.profiles.create({
      name: 'Other',
      email: 'other-cards@example.test',
      locale: 'pt-BR',
    });
    assert.ok(other.ok);
    assert.equal(f.cards.list().length, 0);
    assert.throws(() => f.cards.details(id), /card_not_found/);
    assert.throws(
      () => f.cards.associate(entry.id, association),
      /transaction_not_found/,
    );
    assert.throws(() => f.cards.rename(second, 'Other'), /card_not_found/);
  } finally {
    f.db.$client.close();
  }
});

test('timeline joins cannot reveal another profile invoice payment even for corrupt legacy links', () => {
  const f = fixture();
  try {
    const other = f.profiles.create({
      name: 'Private',
      email: 'private-cards@example.test',
      locale: 'en-US',
    });
    assert.ok(other.ok);
    const cardId = f.cards.create({
      name: 'Private card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    const invoiceId = f.cards.registerInvoice(cardId, {
      opening_date: '2026-09-21',
      closing_date: '2026-10-20',
      due_date: '2026-10-27',
      includes_closing_day: true,
      total_source: 'statement',
      amount_cents: 40000,
    });
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-10-25' })
      .where(eq(creditCardInvoicesTable.id, invoiceId))
      .run();
    f.profiles.enter(f.profile.id);
    const row = f.db
      .insert(transactionsTable)
      .values({
        name: 'Corrupt legacy link',
        type: 2,
        amount_cents: 100,
        user_id: f.profile.id,
        payment_id: f.input.payment_id,
        reference_date: '2026-10-10',
        credit_card_invoice_id: invoiceId,
      })
      .returning()
      .get()!;
    assert.equal(
      f.transactions.list('2026-10').find((value) => value.id === row.id)!
        .invoice_paid_at,
      null,
    );
    assert.throws(() => f.transactions.get(row.id), /card_not_found/);
  } finally {
    f.db.$client.close();
  }
});

test('audit failures and aggregate overflow roll back purchase, totals and generated invoice', () => {
  const f = fixture();
  try {
    const plan = f.transactions.previewCreate(f.input)!;
    f.db.run(
      sql`CREATE TRIGGER fail_card_audit BEFORE INSERT ON credit_card_history BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END`,
    );
    assert.throws(
      () => f.transactions.create({ ...f.input, correction_token: plan.token }),
      (error: unknown) =>
        error instanceof Error &&
        error.cause instanceof Error &&
        /audit unavailable/.test(error.cause.message),
    );
    assert.equal(f.cards.invoices(f.cardId).length, 0);
    assert.equal(f.db.select().from(transactionsTable).all().length, 0);
    f.db.run(sql`DROP TRIGGER fail_card_audit`);
    f.purchase({ amount_cents: Number.MAX_SAFE_INTEGER });
    assert.throws(
      () => f.transactions.previewCreate({ ...f.input, amount_cents: 1 }),
      /invalid_invoice_total/,
    );
    assert.equal(
      f.cards.invoices(f.cardId)[0].amount_cents,
      Number.MAX_SAFE_INTEGER,
    );
    assert.equal(f.db.select().from(transactionsTable).all().length, 1);
  } finally {
    f.db.$client.close();
  }
});

test('card invoices, settings and correction history survive restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'card-restart-'));
  const filename = join(directory, 'finance.db');
  const f = fixture(filename);
  const entry = f.purchase({ reference_date: '2024-10-20' });
  f.db.$client.close();
  const db = initDb(filename, migrations);
  try {
    const profiles = createProfileService(db);
    profiles.enter(f.profile.id);
    const cards = createCreditCardService(db, () => profiles.requireActive());
    assert.equal(cards.list()[0].closing_day, 20);
    assert.equal(
      cards.details(entry.credit_card_invoice_id!).invoice.amount_cents,
      10000,
    );
    assert.ok(cards.details(entry.credit_card_invoice_id!).history.length >= 2);
  } finally {
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('billing migration retains unknown history and rolls back duplicate-period conflicts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'card-upgrade-'));
  const oldFolder = join(directory, 'migrations');
  for (const folder of readdirSync(migrations).filter(
    (name) => !name.endsWith('_credit_card_billing'),
  )) {
    cpSync(join(migrations, folder), join(oldFolder, folder), {
      recursive: true,
    });
  }
  const filename = join(directory, 'finance.db');
  let db = initDb(filename, oldFolder);
  const profiles = createProfileService(db);
  const profile = profiles.create({
    name: 'Old',
    email: 'old@example.test',
    locale: 'en-US',
  });
  assert.ok(profile.ok);
  db.run(
    sql`INSERT INTO credit_cards (id, name, user_id) VALUES (7, 'Old card', ${profile.profile.id})`,
  );
  db.run(
    sql`INSERT INTO credit_card_invoice (id, credit_card_id, amount_cents, closing_date, due_date, paid_at) VALUES (9, 7, 50000, '2024-10-20', '2024-10-27', '2024-11-02')`,
  );
  db.$client.close();
  db = initDb(filename, migrations);
  try {
    const row = db.select().from(creditCardInvoicesTable).get()!;
    assert.equal(row.id, 9);
    assert.equal(row.opening_date, null);
    assert.equal(row.includes_closing_day, null);
    assert.equal(row.total_source, 'statement');
    assert.equal(row.amount_cents, 50000);
    assert.equal(row.paid_at, '2024-11-02');
    assert.equal(db.select().from(creditCardsTable).get()!.closing_day, null);
  } finally {
    db.$client.close();
  }
  const conflict = join(directory, 'conflict.db');
  db = initDb(conflict, oldFolder);
  db.run(
    sql`INSERT INTO user (id, name, email, password) VALUES (1, 'Owner', 'duplicate@example.test', 'disabled')`,
  );
  db.run(
    sql`INSERT INTO credit_cards (id, name, user_id) VALUES (1, 'Card', 1)`,
  );
  db.run(
    sql`INSERT INTO credit_card_invoice (credit_card_id, amount_cents, closing_date, due_date) VALUES (1, 10, '2024-10-20', '2024-10-27'), (1, 20, '2024-10-20', '2024-10-27')`,
  );
  db.$client.close();
  assert.throws(() => initDb(conflict, migrations));
  db = initDb(conflict, oldFolder);
  try {
    assert.equal(db.all(sql`SELECT * FROM credit_card_invoice`).length, 2);
    assert.equal(
      db
        .all<{ name: string }>(sql`PRAGMA table_info(credit_cards)`)
        .some((row) => row.name === 'closing_day'),
      false,
    );
  } finally {
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('full invoice settlement is idempotent, preserves purchases and moves one cash-flow event on correction and undo', () => {
  const f = fixture();
  try {
    const purchase = f.purchase();
    const other = f.purchase({ reference_date: '2026-11-05' });
    const invoiceId = purchase.credit_card_invoice_id!;
    const originalEntries = f.db.select().from(transactionsTable).all();
    const snapshots = createFinancialMonthService(f.db, () =>
      f.profiles.requireActive(),
    );
    const payment = {
      paid_at: '2026-12-02',
      expected_paid_at: null,
      expected_amount_cents: 10000,
    };
    assert.equal(f.statements.get('2026-10').expense, 100);
    assert.equal(f.statements.get('2026-12').expense, 0);
    f.cards.setPayment(invoiceId, payment);
    const historyCount = f.cards.details(invoiceId).history.length;
    f.cards.setPayment(invoiceId, payment);
    assert.equal(f.cards.details(invoiceId).history.length, historyCount);
    assert.deepEqual(
      f.db.select().from(transactionsTable).all(),
      originalEntries,
    );
    assert.equal(
      f.transactions.list('2026-10')[0].invoice_paid_at,
      payment.paid_at,
    );
    assert.equal(f.transactions.list('2026-11')[0].invoice_paid_at, null);
    assert.equal(f.cards.invoice(other.credit_card_invoice_id!).paid_at, null);
    assert.equal(f.statements.get('2026-10').expense, 0);
    assert.equal(f.statements.get('2026-12').expense, 100);
    const december = snapshots.get('2026-12');
    assert.deepEqual(december.transactions, []);
    assert.equal(december.invoice_payments!.length, 1);
    assert.deepEqual(december.invoice_payments![0], {
      invoice_id: invoiceId,
      card_name: 'Everyday',
      closing_date: '2026-10-20',
      paid_at: '2026-12-02',
      amount_cents: 10000,
    });
    assert.deepEqual(snapshots.get('2026-10').invoice_payments, []);
    f.cards.setPayment(invoiceId, {
      ...payment,
      paid_at: '2026-09-30',
      expected_paid_at: payment.paid_at,
    });
    assert.equal(f.cards.payments('2026-12').length, 0);
    assert.equal(f.cards.payments('2026-09').length, 1);
    assert.equal(f.statements.get('2026-09').expense, 100);
    assert.equal(f.statements.get('2026-12').expense, 0);
    f.cards.setPayment(invoiceId, {
      ...payment,
      paid_at: null,
      expected_paid_at: '2026-09-30',
    });
    assert.equal(f.cards.payments('2026-09').length, 0);
    assert.equal(f.statements.get('2026-09').expense, 0);
    assert.equal(f.statements.get('2026-10').expense, 100);
    assert.equal(f.transactions.list('2026-10')[0].invoice_paid_at, null);
    assert.deepEqual(
      f.db.select().from(transactionsTable).all(),
      originalEntries,
    );
    assert.deepEqual(
      f.cards
        .details(invoiceId)
        .history.slice(0, 3)
        .map((row) => row.operation),
      ['undo_invoice_payment', 'correct_invoice_payment', 'pay_invoice'],
    );
  } finally {
    f.db.$client.close();
  }
});

test('settlement preserves statement totals, rejects invalid or stale inputs and rolls back if auditing fails', () => {
  const f = fixture();
  try {
    const invoiceId = f.cards.registerInvoice(f.cardId, {
      opening_date: '2020-01-01',
      closing_date: '2020-01-20',
      due_date: '2020-01-27',
      includes_closing_day: true,
      total_source: 'statement',
      amount_cents: 45000,
    });
    f.purchase({
      reference_date: '2020-01-10',
      credit_card_invoice_id: invoiceId,
    });
    const payment = {
      paid_at: '2020-02-03',
      expected_paid_at: null,
      expected_amount_cents: 45000,
    };
    for (const date of ['2026-02-30', 'bad', '', '2026-1-01']) {
      assert.throws(
        () => f.cards.setPayment(invoiceId, { ...payment, paid_at: date }),
        /invalid_invoice_payment/,
      );
    }
    assert.throws(
      () =>
        f.cards.setPayment(invoiceId, {
          ...payment,
          expected_paid_at: undefined as never,
        }),
      /invalid_invoice_payment/,
    );
    assert.throws(
      () =>
        f.cards.setPayment(invoiceId, {
          ...payment,
          expected_amount_cents: 10000,
        }),
      /stale_invoice_payment/,
    );
    f.db.$client.exec(
      "CREATE TRIGGER fail_payment_history BEFORE INSERT ON credit_card_history WHEN NEW.operation = 'pay_invoice' BEGIN SELECT RAISE(ABORT, 'audit_failed'); END",
    );
    assert.throws(
      () => f.cards.setPayment(invoiceId, payment),
      (error: unknown) =>
        (error as { cause?: Error }).cause?.message === 'audit_failed',
    );
    assert.equal(f.cards.invoice(invoiceId).paid_at, null);
    assert.equal(f.cards.payments('2020-02').length, 0);
    f.db.$client.exec('DROP TRIGGER fail_payment_history');
    f.cards.setPayment(invoiceId, payment);
    assert.equal(f.cards.payments('2020-02')[0].amount_cents, 45000);
    assert.equal(f.statements.get('2020-02').expense, 450);
    assert.equal(f.cards.details(invoiceId).invoice.difference_cents, 35000);
    assert.throws(
      () =>
        f.cards.setPayment(invoiceId, { ...payment, paid_at: '2020-03-01' }),
      /stale_invoice_payment/,
    );
    assert.throws(
      () => f.cards.setPayment(invoiceId, { ...payment, paid_at: null }),
      /stale_invoice_payment/,
    );
    assert.equal(f.cards.invoice(invoiceId).paid_at, payment.paid_at);
    assert.throws(
      () => f.cards.setPayment(999999, payment),
      /invoice_not_found/,
    );
    f.cards.archive(f.cardId);
    f.cards.setPayment(invoiceId, {
      ...payment,
      paid_at: '2020-02-04',
      expected_paid_at: payment.paid_at,
    });
    assert.equal(f.cards.payments('2020-02').length, 1);
    const profile = f.profiles.create({
      name: 'Other owner',
      email: 'other-payment@example.test',
      locale: 'en-US',
    });
    assert.ok(profile.ok);
    assert.throws(
      () => f.cards.setPayment(invoiceId, payment),
      /card_not_found/,
    );
    assert.deepEqual(f.cards.payments('2020-02'), []);
  } finally {
    f.db.$client.close();
  }
});
