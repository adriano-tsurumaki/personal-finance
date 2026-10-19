import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createInstallmentService } from '../installments';
import { createTransactionService } from '../transactions';
import { createCreditCardService } from '../credit-cards';
import { createMonthlyStatementService } from '../monthly-statement';
import { createRecurrenceService } from '../recurrences';
import { installmentSchedule } from '../installments/schedule';
import {
  cardHistoryTable,
  creditCardInvoicesTable,
  installmentRequestsTable,
  installmentsTable,
  transactionsTable,
} from './schema';
import type { InstallmentInput } from '@shared/contracts/installment';

function setup() {
  const db = initDb(':memory:', resolve('drizzle'));
  const profiles = createProfileService(db);
  const created = profiles.create({
    name: 'Installments',
    email: 'plans@example.test',
    locale: 'en-US',
  });
  assert.ok(created.ok);
  const user = () => profiles.requireActive();
  const service = createInstallmentService(db, user);
  const transactions = createTransactionService(db, user);
  const cards = createCreditCardService(db, user);
  const input: InstallmentInput = {
    request_id: 'request-installment-0001',
    name: 'Purchase',
    note: 'Detail',
    total_amount_cents: 10000,
    total_installments: 3,
    purchase_at: '2027-01-15',
    start_date: '2027-01-31',
    payment_id: profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id,
    category_id: null,
    card_id: cards.create({
      name: 'Purchase card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    }),
    historical_card: false,
    invoice_ids: [],
  };
  return { db, profiles, service, transactions, cards, input };
}

test('installment calendar preserves its anchor and distributes exact integer cents', () => {
  assert.deepEqual(installmentSchedule(10000, 3, '2027-01-31'), [
    { installment_number: 1, amount_cents: 3334, reference_date: '2027-01-31' },
    { installment_number: 2, amount_cents: 3333, reference_date: '2027-02-28' },
    { installment_number: 3, amount_cents: 3333, reference_date: '2027-03-31' },
  ]);
  assert.equal(
    installmentSchedule(300, 3, '2028-01-31')[1].reference_date,
    '2028-02-29',
  );
  assert.equal(
    installmentSchedule(300, 3, '2027-12-31')[1].reference_date,
    '2028-01-31',
  );

  for (const [total, count] of [
    [1, 2],
    [100, 1],
    [1000, 121],
    [100, 2.1],
    [Number.MAX_SAFE_INTEGER + 1, 2],
  ]) {
    assert.throws(() => installmentSchedule(total, count, '2027-01-01'));
  }

  assert.throws(() => installmentSchedule(100, 2, '9999-12-31'));
});

test('credit creation is atomic, previews are read-only, retries are durable and deletion retains a receipt', () => {
  const { db, service, input, transactions } = setup();
  try {
    const preview = service.preview(input);
    assert.equal(db.select().from(installmentsTable).all().length, 0);
    assert.equal(db.select().from(transactionsTable).all().length, 0);
    assert.throws(() => service.create(input, 'stale'), /stale_correction/);
    assert.equal(service.list().length, 0);
    const id = service.create(input, preview.correction.token);
    assert.equal(service.create({ ...input }, preview.correction.token), id);
    assert.throws(
      () =>
        service.create(
          { ...input, name: 'Different' },
          preview.correction.token,
        ),
      /request_conflict/,
    );
    assert.equal(service.list().length, 1);
    assert.equal(service.list()[0].repair_required, false);
    const row = transactions.list('2027-01')[0];
    assert.equal(row.installment_number, 1);
    assert.equal(row.total_installments, 3);
    const details = transactions.get(row.id);
    assert.throws(
      () => transactions.update(row.id, details),
      /installment_managed/,
    );
    assert.throws(
      () => transactions.previewUpdate(row.id, details),
      /installment_managed/,
    );
    assert.throws(
      () => transactions.previewRemove(row.id),
      /installment_managed/,
    );
    assert.throws(() => transactions.remove(row.id), /installment_managed/);
    const statements = createMonthlyStatementService(db, () => ({
      id: details.user_id,
    }));
    assert.equal(statements.get('2027-02').expense, 33.33);
    assert.equal(statements.get('2027-03').closingBalance, -100);
    service.rename(id, 'New name', 'New note');
    assert.equal(service.list()[0].repair_required, false);
    assert.equal(transactions.get(row.id).name, 'New name');
    const deletion = service.previewRemove(id);
    assert.throws(() => service.remove(id, 'stale'), /stale_correction/);
    service.remove(id, deletion.correction.token);
    assert.equal(service.list().length, 0);
    assert.equal(
      db.select().from(installmentRequestsTable).get()!.installment_id,
      null,
    );
    assert.throws(
      () => service.create(input, preview.correction.token),
      /request_conflict/,
    );
    assert.equal(statements.get('2027-03').closingBalance, 0);
  } finally {
    db.$client.close();
  }
});

test('card installments use successive invoices and preserve statement amounts and payment dates', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    const cardId = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.card_id = cardId;
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    const period = cards.previewPeriod(cardId, '2027-01');
    const invoiceId = cards.registerInvoice(cardId, {
      ...period,
      amount_cents: 7000,
      total_source: 'statement',
    });
    db.update(creditCardInvoicesTable)
      .set({ paid_at: '2027-01-27' })
      .where(eq(creditCardInvoicesTable.id, invoiceId))
      .run();
    const countHistory = db.select().from(cardHistoryTable).all().length;
    const preview = service.preview(input);
    assert.equal(cards.invoices(cardId).length, 1);
    assert.equal(db.select().from(cardHistoryTable).all().length, countHistory);
    const id = service.create(input, preview.correction.token);
    const plan = service.list()[0];
    assert.equal(plan.repair_required, false);
    assert.deepEqual(
      plan.entries.map((row) => row.invoice!.closing_date),
      ['2027-01-20', '2027-02-20', '2027-03-20'],
    );
    assert.equal(cards.details(invoiceId).invoice.amount_cents, 7000);
    assert.equal(cards.details(invoiceId).invoice.paid_at, '2027-01-27');
    assert.equal(cards.details(invoiceId).invoice.items_total_cents, 3334);
    const statements = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(statements.get('2027-01').expense, 70);
    assert.equal(statements.get('2027-02').expense, 33.33);
    assert.throws(() => service.previewRemove(id), /installment_paid/);
    assert.throws(
      () =>
        cards.associate(plan.entries[0].id, {
          card_id: cardId,
          invoice_id: invoiceId,
        }),
      /installment_managed/,
    );
  } finally {
    db.$client.close();
  }
});

test('changed invoice membership invalidates the whole preview and cross-profile references are rejected', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    const cardId = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.card_id = cardId;
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    const preview = service.preview(input);
    const invoiceId = cards.registerInvoice(cardId, {
      ...cards.previewPeriod(cardId, '2027-01'),
      total_source: 'statement',
      amount_cents: 9000,
    });
    assert.throws(
      () => service.create(input, preview.correction.token),
      /stale_correction/,
    );
    assert.equal(service.list().length, 0);
    assert.equal(cards.invoices(cardId).length, 1);
    const current = service.preview(input);
    const id = service.create(input, current.correction.token);
    const other = profiles.create({
      name: 'Other',
      email: 'other@example.test',
      locale: 'en-US',
    });
    assert.ok(other.ok);
    assert.equal(service.list().length, 0);
    assert.throws(() => service.previewRemove(id), /not_found/);
    assert.throws(
      () => service.preview({ ...input, invoice_ids: [invoiceId] }),
      /card_not_found/,
    );
  } finally {
    db.$client.close();
  }
});

test('failures in later invoice resolution roll back the entire plan and malformed legacy groups remain readable', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: false,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.invoice_ids = [null, 999999];
    assert.throws(() => service.preview(input), /invoice_not_found/);
    assert.equal(cards.invoices(input.card_id).length, 0);
    assert.equal(service.list().length, 0);
    input.invoice_ids = [];
    const preview = service.preview(input);
    const id = service.create(input, preview.correction.token);
    db.delete(transactionsTable)
      .where(eq(transactionsTable.id, service.list()[0].entries[1].id))
      .run();
    assert.equal(service.list()[0].repair_required, true);
    assert.throws(() => service.previewRemove(id), /repair_required/);
    assert.throws(() => service.rename(id, 'Rename', null), /repair_required/);
  } finally {
    db.$client.close();
  }
});

test('unpaid statement deletion preserves its outflow while calculated totals and audit failures remain atomic', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    const invoiceId = cards.registerInvoice(input.card_id, {
      ...cards.previewPeriod(input.card_id, '2027-01'),
      total_source: 'statement',
      amount_cents: 8000,
    });
    let proposal = service.preview(input);
    db.$client.exec(
      "CREATE TRIGGER reject_plan_audit BEFORE INSERT ON credit_card_history WHEN NEW.operation = 'create_installment_plan' BEGIN SELECT RAISE(ABORT, 'audit_failure'); END",
    );
    assert.throws(
      () => service.create(input, proposal.correction.token),
      (error: Error) => String(error.cause).includes('audit_failure'),
    );
    assert.equal(service.list().length, 0);
    assert.equal(db.select().from(installmentRequestsTable).all().length, 0);
    assert.equal(cards.invoices(input.card_id).length, 1);
    db.$client.exec('DROP TRIGGER reject_plan_audit');
    proposal = service.preview(input);
    const id = service.create(input, proposal.correction.token);
    assert.equal(cards.details(invoiceId).invoice.items_total_cents, 3334);
    const removal = service.previewRemove(id);
    service.remove(id, removal.correction.token);
    assert.equal(cards.details(invoiceId).invoice.items_total_cents, 0);
    assert.equal(cards.details(invoiceId).invoice.amount_cents, 8000);
    assert.equal(
      cards
        .invoices(input.card_id)
        .find((row) => row.closing_date === '2027-02-20')!.amount_cents,
      0,
    );
    assert.equal(
      db.select().from(cardHistoryTable).all().at(-1)!.operation,
      'delete_installment_plan',
    );
  } finally {
    db.$client.close();
  }
});

test('explicit legacy mappings work for archived cards and duplicate-save receipts survive catalog changes', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    const cardId = cards.create({
      name: 'Archived',
      closing_day: 20,
      includes_closing_day: false,
      due_days_after_closing: 7,
    });
    input.card_id = cardId;
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.invoice_ids = ['2027-02', '2027-03', '2027-04'].map((month) =>
      cards.registerInvoice(cardId, {
        ...cards.previewPeriod(cardId, month),
        total_source: 'statement',
        amount_cents: 5000,
      }),
    );
    cards.archive(cardId);
    assert.throws(() => service.preview(input), /archived_card/);
    input.historical_card = true;
    // Historical cards need no guessed rules when all concrete invoices are supplied.
    db.$client
      .prepare(
        'UPDATE credit_cards SET closing_day = NULL, includes_closing_day = NULL, due_days_after_closing = NULL WHERE id = ?',
      )
      .run(cardId);
    const proposal = service.preview(input);
    assert.deepEqual(
      proposal.plan.entries.map((row) => row.invoice!.closing_date),
      ['2027-02-20', '2027-03-20', '2027-04-20'],
    );
    const id = service.create(input, proposal.correction.token);
    assert.equal(service.create(input, proposal.correction.token), id);
    assert.throws(
      () =>
        service.preview({
          ...input,
          request_id: 'request-installment-0002',
          invoice_ids: [],
        }),
      /unknown|invalid_card/,
    );
    const row = service.list()[0].entries[0];
    db.update(transactionsTable)
      .set({ payment_date: '2027-02-27' })
      .where(eq(transactionsTable.id, row.id))
      .run();
    assert.equal(service.list()[0].repair_required, true);
  } finally {
    db.$client.close();
  }
});

test('a late first invoice override and closing-day inclusion are independent from the timeline anchor', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: false,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.purchase_at = '2027-01-20';
    let proposal = service.preview(input);
    assert.equal(proposal.plan.entries[0].invoice!.closing_date, '2027-02-20');
    const invoiceId = cards.registerInvoice(input.card_id, {
      ...cards.previewPeriod(input.card_id, '2027-03'),
      total_source: 'calculated',
      amount_cents: 0,
    });
    input.invoice_ids = [invoiceId];
    proposal = service.preview(input);
    const id = service.create(input, proposal.correction.token);
    const plan = service.list().find((row) => row.id === id)!;
    assert.deepEqual(
      plan.entries.map((row) => row.invoice!.closing_date),
      ['2027-03-20', '2027-04-20', '2027-05-20'],
    );
    assert.equal(plan.entries[0].reference_date, '2027-01-31');
    const summaries = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(summaries.get('2027-01').expense, 0);
    assert.equal(summaries.get('2027-03').expense, 33.34);
  } finally {
    db.$client.close();
  }
});

test('invoice boundary corrections cannot move an installment into a neighboring invoice', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.start_date = '2027-01-20';
    const proposal = service.preview(input);
    service.create(input, proposal.correction.token);
    const invoice = service.list()[0].entries[0].invoice!;
    assert.throws(
      () =>
        cards.previewCorrection(invoice.id, {
          opening_date: invoice.opening_date!,
          closing_date: '2027-01-19',
          due_date: '2027-01-27',
          includes_closing_day: true,
          total_source: 'calculated',
          amount_cents: 0,
        }),
      /installment_managed/,
    );
    assert.equal(cards.invoice(invoice.id).closing_date, '2027-01-20');
  } finally {
    db.$client.close();
  }
});

test('installments and projected credit recurrences share invoice cash flow without counting purchases twice', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    const recurrence = createRecurrenceService(db, () =>
      profiles.requireActive(),
    );
    recurrence.create({
      name: 'Subscription',
      type: 2,
      amount_cents: 1000,
      payment_id: input.payment_id,
      category_id: null,
      credit_card_id: input.card_id,
      start_date: '2027-01-10',
      frequency: 3,
      interval: 1,
    });
    const summaries = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(summaries.get('2027-01').expense, 10);
    const proposal = service.preview(input);
    service.create(input, proposal.correction.token);
    assert.equal(summaries.get('2027-01').expense, 43.34);
    assert.equal(summaries.get('2027-02').expense, 43.33);
    assert.equal(summaries.get('2027-03').closingBalance, -130);
  } finally {
    db.$client.close();
  }
});

test('paid calculated invoices require a preview of the historical payment-month change', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    const id = cards.registerInvoice(input.card_id, {
      ...cards.previewPeriod(input.card_id, '2027-01'),
      total_source: 'calculated',
      amount_cents: 0,
    });
    db.update(creditCardInvoicesTable)
      .set({ paid_at: '2027-02-02' })
      .where(eq(creditCardInvoicesTable.id, id))
      .run();
    const proposal = service.preview(input);
    assert.deepEqual(proposal.correction.affected_payment_months, ['2027-02']);
    assert.equal(proposal.plan.entries[0].invoice!.amount_cents, 3334);
    service.create(input, proposal.correction.token);
    const summaries = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(summaries.get('2027-01').expense, 0);
    assert.equal(summaries.get('2027-02').expense, 66.67);
    assert.equal(cards.invoice(id).paid_at, '2027-02-02');
  } finally {
    db.$client.close();
  }
});

test('the full supported schedule preserves cents and rejects a missing save authorization', () => {
  const { db, service, input } = setup();
  try {
    input.total_installments = 120;
    input.total_amount_cents = Number.MAX_SAFE_INTEGER;
    const proposal = service.preview(input);
    assert.equal(proposal.plan.entries.length, 120);
    assert.equal(proposal.plan.end_date, '2036-12-31');
    assert.equal(
      proposal.plan.entries.reduce(
        (sum, row) => sum + BigInt(row.amount_cents),
        0n,
      ),
      BigInt(Number.MAX_SAFE_INTEGER),
    );
    assert.throws(
      () => service.create(input, undefined as unknown as string),
      /stale_correction/,
    );
    assert.equal(service.list().length, 0);
  } finally {
    db.$client.close();
  }
});

test('custom installment amounts are validated, previewed and persisted without invalidating group management', () => {
  const { db, service, input } = setup();
  try {
    input.installment_amounts_cents = [3000, 3500, 3500];
    const preview = service.preview(input);
    assert.equal(preview.plan.repair_required, false);
    assert.deepEqual(
      preview.plan.entries.map((row) => row.amount_cents),
      input.installment_amounts_cents,
    );
    assert.throws(
      () =>
        service.create(
          { ...input, installment_amounts_cents: [3500, 3500, 3000] },
          preview.correction.token,
        ),
      /stale_correction/,
    );
    const id = service.create(input, preview.correction.token);
    assert.equal(service.create(input, preview.correction.token), id);
    assert.equal(service.list()[0].repair_required, false);
    service.rename(id, 'Custom purchase', null);
    const removal = service.previewRemove(id);
    service.remove(id, removal.correction.token);
    for (const amounts of [
      [100, 100],
      [0, 5000, 5000],
      [1.5, 4998.5, 5000],
      [3000, 3000, 3000],
    ]) {
      assert.throws(
        () =>
          service.preview({
            ...input,
            request_id: 'invalid-allocation-0001',
            installment_amounts_cents: amounts,
          }),
        /invalid_installment_allocation/,
      );
    }
  } finally {
    db.$client.close();
  }
});

test('later reference dates can follow invoice openings while the first installment keeps its original date', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Month end',
      closing_day: 31,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.purchase_at = '2027-08-08';
    input.start_date = '2027-08-08';
    input.use_invoice_opening_date = true;
    input.installment_amounts_cents = [3000, 3500, 3500];
    const preview = service.preview(input);
    assert.deepEqual(
      preview.plan.entries.map((row) => row.reference_date),
      ['2027-08-08', '2027-09-01', '2027-10-01'],
    );
    assert.equal(preview.plan.end_date, '2027-10-01');
    assert.equal(preview.plan.repair_required, false);
    const id = service.create(input, preview.correction.token);
    assert.equal(service.list()[0].repair_required, false);
    service.rename(id, 'Month-start installments', null);
    assert.equal(service.list()[0].repair_required, false);
    assert.equal(service.create(input, preview.correction.token), id);
    const statements = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(statements.get('2027-09').expense, 30);
    const removal = service.previewRemove(id);
    service.remove(id, removal.correction.token);
  } finally {
    db.$client.close();
  }
});

test('invoice opening dates are actual period starts, including short months, and unknown starts are never guessed', () => {
  const { db, service, cards, profiles, input } = setup();
  try {
    input.card_id = cards.create({
      name: 'Mid month',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
    });
    input.payment_id = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'credit')!.id;
    input.start_date = '2027-01-15';
    input.use_invoice_opening_date = true;
    let preview = service.preview(input);
    assert.deepEqual(
      preview.plan.entries.map((row) => row.reference_date),
      ['2027-01-15', '2027-01-21', '2027-02-21'],
    );
    const second = cards.registerInvoice(input.card_id, {
      ...cards.previewPeriod(input.card_id, '2027-02'),
      total_source: 'statement',
      amount_cents: 5000,
    });
    db.update(creditCardInvoicesTable)
      .set({ opening_date: null })
      .where(eq(creditCardInvoicesTable.id, second))
      .run();
    assert.throws(
      () => service.preview(input),
      /invalid_installment_invoice_dates/,
    );
    assert.equal(service.list().length, 0);
    input.use_invoice_opening_date = false;
    preview = service.preview(input);
    assert.deepEqual(
      preview.plan.entries.map((row) => row.reference_date),
      ['2027-01-15', '2027-02-15', '2027-03-15'],
    );
    assert.throws(
      () =>
        service.preview({
          ...input,
          card_id: null,
          use_invoice_opening_date: true,
        }),
      /invalid_installment_allocation/,
    );
  } finally {
    db.$client.close();
  }
});

test('receipts from before editable allocations remain readable and retryable with default options', () => {
  const { db, service, input } = setup();
  try {
    const preview = service.preview(input);
    const id = service.create(input, preview.correction.token);
    const receipt = db.select().from(installmentRequestsTable).get()!;
    const stored = JSON.parse(receipt.input_json);
    delete stored.reference_dates;
    delete stored.installment_amounts_cents;
    delete stored.use_invoice_opening_date;
    db.update(installmentRequestsTable)
      .set({ input_json: JSON.stringify(stored) })
      .where(eq(installmentRequestsTable.id, receipt.id))
      .run();
    assert.equal(service.list()[0].repair_required, false);
    assert.equal(
      service.create(
        {
          ...input,
          installment_amounts_cents: [],
          use_invoice_opening_date: false,
        },
        preview.correction.token,
      ),
      id,
    );
    assert.throws(
      () =>
        service.create(
          { ...input, installment_amounts_cents: [3000, 3500, 3500] },
          preview.correction.token,
        ),
      /installment_request_conflict/,
    );
    assert.equal(service.list().length, 1);
  } finally {
    db.$client.close();
  }
});

test('creation rejects PIX, cash and debit even with a card, and credit requires a selected card', () => {
  const { db, service, profiles, input } = setup();
  try {
    const valid = service.preview(input);

    for (const method of ['pix', 'cash', 'debit']) {
      const payment = profiles
        .options()
        .payments.find((row) => row.catalog_key === method)!;

      for (const card of [null, input.card_id]) {
        const invalid = { ...input, payment_id: payment.id, card_id: card };
        assert.throws(
          () => service.preview(invalid),
          /installment_credit_required/,
        );
        assert.throws(
          () => service.create(invalid, valid.correction.token),
          /installment_credit_required/,
        );
      }
    }

    assert.throws(
      () => service.preview({ ...input, card_id: null }),
      /installment_credit_required/,
    );
    assert.throws(
      () => service.create({ ...input, card_id: null }, valid.correction.token),
      /installment_credit_required/,
    );
    assert.equal(service.list().length, 0);
    service.create(input, valid.correction.token);
    assert.equal(service.list().length, 1);
  } finally {
    db.$client.close();
  }
});

test('legacy direct installment plans remain readable and manageable without permitting new direct purchases', () => {
  const { db, service, profiles, input } = setup();
  try {
    const paymentId = profiles
      .options()
      .payments.find((row) => row.catalog_key === 'pix')!.id;
    const group = db
      .insert(installmentsTable)
      .values({
        name: 'Legacy direct purchase',
        total_installments: 2,
        total_amount_cents: 10000,
        purchase_at: '2027-01-15',
        start_date: '2027-01-31',
        end_date: '2027-02-28',
        user_id: profiles.requireActive().id,
      })
      .returning()
      .get()!;

    for (const [index, reference] of ['2027-01-31', '2027-02-28'].entries()) {
      db.insert(transactionsTable)
        .values({
          name: group.name,
          type: 2,
          amount_cents: 5000,
          reference_date: reference,
          user_id: group.user_id,
          payment_id: paymentId,
          installment_id: group.id,
          installment_number: index + 1,
        })
        .run();
    }

    assert.equal(service.list()[0].repair_required, false);
    service.rename(group.id, 'Preserved direct purchase', null);
    const removal = service.previewRemove(group.id);
    assert.throws(
      () => service.preview({ ...input, card_id: null, payment_id: paymentId }),
      /installment_credit_required/,
    );
    assert.equal(service.list()[0].name, 'Preserved direct purchase');
    service.remove(group.id, removal.correction.token);
    assert.equal(service.list().length, 0);
  } finally {
    db.$client.close();
  }
});
