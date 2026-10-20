import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createCreditCardService } from '../credit-cards';
import { createTransactionService } from '../transactions';
import { createInstallmentService } from '../installments';
import { createRecurrenceService } from '../recurrences';
import { createMonthlyStatementService } from '../monthly-statement';
import {
  allocateFinancing,
  financingAmounts,
} from '@shared/lib/credit-financing';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';
import type { InstallmentInput } from '@shared/contracts/installment';
import {
  cardHistoryTable,
  creditCardInvoicesTable,
  transactionsTable,
} from './schema';

const terms: CreditFinancingInput = {
  principal_cents: 10000,
  interest: { mode: 'percent', value: 2 },
  iof: { mode: 'amount', value: 50 },
};

function fixture() {
  const db = initDb(':memory:', resolve('drizzle'));
  const profiles = createProfileService(db);
  profiles.create({
    name: 'Owner',
    email: 'financing@example.test',
    locale: 'en-US',
  });
  const owner = () => profiles.requireActive();
  const cards = createCreditCardService(db, owner);
  const card = cards.create({
    name: 'Card',
    closing_day: 20,
    includes_closing_day: true,
    due_days_after_closing: 7,
  });
  const method = (key: string) =>
    profiles.options().payments.find((row) => row.catalog_key === key)!.id;
  return {
    db,
    profiles,
    cards,
    card,
    method,
    transactions: createTransactionService(db, owner),
    plans: createInstallmentService(db, owner),
    recurrences: createRecurrenceService(db, owner),
    statements: createMonthlyStatementService(db, owner),
  };
}

test('charges round half up, reject invalid values and preserve every allocated component', () => {
  assert.deepEqual(financingAmounts(terms), {
    principal_cents: 10000,
    interest_cents: 200,
    iof_cents: 50,
    total_cents: 10250,
  });
  assert.equal(
    financingAmounts({
      ...terms,
      principal_cents: 101,
      interest: { mode: 'percent', value: 0.5 },
    }).interest_cents,
    1,
  );
  for (const invalid of [-1, NaN, Infinity, 1.001]) {
    assert.throws(() =>
      financingAmounts({
        ...terms,
        interest: { mode: 'percent', value: invalid },
      }),
    );
  }
  assert.throws(() =>
    financingAmounts({ ...terms, principal_cents: Number.MAX_SAFE_INTEGER }),
  );
  for (let principal = 1; principal < 40; principal++) {
    const input: CreditFinancingInput = {
      principal_cents: principal,
      interest: { mode: 'amount', value: 7 },
      iof: { mode: 'amount', value: 1 },
    };
    const total = principal + 8;
    for (let first = 1; first < total; first++) {
      const rows = allocateFinancing(input, [first, total - first]);
      for (const [key, expected] of [
        ['principal_cents', principal],
        ['interest_cents', 7],
        ['iof_cents', 1],
      ] as const) {
        assert.equal(
          rows.reduce((sum, row) => sum + row[key], 0),
          expected,
        );
      }
      rows.forEach((row) => {
        assert.ok(
          row.principal_cents >= 0 &&
            row.interest_cents >= 0 &&
            row.iof_cents >= 0,
        );
        assert.equal(
          row.principal_cents + row.interest_cents + row.iof_cents,
          row.total_cents,
        );
      });
    }
  }
});

test('both financed methods require a card, retain terms and reconcile only the total invoice outflow', () => {
  for (const key of ['pix_credit', 'boleto_credit']) {
    const f = fixture();
    try {
      const input = {
        name: 'Payment',
        type: 2 as const,
        amount_cents: 10250,
        financing: terms,
        reference_date: '2026-10-05',
        payment_date: null,
        user_id: f.profiles.requireActive().id,
        category_id: null,
        payment_id: f.method(key),
        card_id: f.card,
      };
      assert.throws(
        () => f.transactions.previewCreate({ ...input, card_id: null }),
        /credit_card_required/,
      );
      assert.throws(
        () => f.transactions.previewCreate({ ...input, financing: null }),
        /invalid_financing/,
      );
      assert.throws(
        () => f.transactions.previewCreate({ ...input, amount_cents: 10000 }),
        /invalid_financing/,
      );
      assert.throws(
        () =>
          f.transactions.previewCreate({
            ...input,
            payment_id: f.method('pix'),
          }),
        /invalid_financing/,
      );
      const preview = f.transactions.previewCreate(input)!;
      assert.equal(f.db.select().from(transactionsTable).all().length, 0);
      assert.equal(f.db.select().from(creditCardInvoicesTable).all().length, 0);
      f.transactions.create({ ...input, correction_token: preview.token });
      const row = f.transactions.list('2026-10')[0];
      assert.equal(row.payment_method, key);
      assert.deepEqual(row.financing, financingAmounts(terms));
      assert.deepEqual(f.transactions.get(row.id).financing, terms);
      assert.equal(f.statements.get('2026-10').expense, 102.5);
      assert.throws(
        () => f.transactions.update(row.id, { ...input, amount_cents: 10000 }),
        /invalid_financing/,
      );
      const revised = {
        ...input,
        financing: {
          ...terms,
          interest: { mode: 'amount' as const, value: 300 },
        },
        amount_cents: 10350,
      };
      const correction = f.transactions.previewUpdate(row.id, revised);
      f.transactions.update(row.id, {
        ...revised,
        correction_token: correction.token,
      });
      assert.equal(f.statements.get('2026-10').expense, 103.5);
      assert.equal(
        f.transactions.list('2026-10')[0].financing?.interest_cents,
        300,
      );
      f.profiles.create({
        name: 'Other',
        email: 'other@example.test',
        locale: 'en-US',
      });
      assert.throws(() => f.transactions.get(row.id), /not found/);
      assert.throws(() => f.transactions.previewCreate(input), /not_found/);
    } finally {
      f.db.$client.close();
    }
  }
});

test('one rent occurrence becomes two future invoice charges atomically without changing subsequent defaults', () => {
  const f = fixture();
  try {
    const defaults = {
      name: 'Rent',
      type: 2 as const,
      amount_cents: 10000,
      category_id: null,
      payment_id: f.method('pix'),
      credit_card_id: null,
    };
    const recurrence = f.recurrences.create({
      ...defaults,
      start_date: '2026-10-05',
      frequency: 3,
      interval: 1,
    });
    const slot = f.recurrences.month('2026-10').occurrences[0];
    const draft: InstallmentInput = {
      request_id: 'rent-financing-request-0001',
      name: 'Rent',
      note: null,
      total_amount_cents: 10250,
      total_installments: 2,
      financing: terms,
      payment_id: f.method('boleto_credit'),
      card_id: f.card,
      category_id: null,
      purchase_at: '2026-10-05',
      start_date: '2026-11-05',
      invoice_ids: [],
      first_invoice_month: '2026-11',
      historical_card: false,
    };
    const history = f.db.select().from(cardHistoryTable).all();
    const invoices = f.db.select().from(creditCardInvoicesTable).all();
    const preview = f.plans.preview(draft);
    assert.equal(f.db.select().from(transactionsTable).all().length, 0);
    assert.deepEqual(f.db.select().from(cardHistoryTable).all(), history);
    assert.deepEqual(
      f.db.select().from(creditCardInvoicesTable).all(),
      invoices,
    );
    const input = {
      ...defaults,
      amount_cents: 10250,
      payment_id: draft.payment_id,
      credit_card_id: f.card,
      recurrence_id: recurrence,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      reference_date: draft.purchase_at,
      installment: draft,
      correction_token: preview.correction.token,
    };
    assert.throws(
      () => f.recurrences.confirm({ ...input, correction_token: 'stale' }),
      /stale_correction/,
    );
    assert.equal(f.plans.list().length, 0);
    const id = f.recurrences.confirm(input);
    assert.equal(f.recurrences.confirm(input), id);
    assert.equal(f.db.select().from(transactionsTable).all().length, 2);
    const plan = f.plans.list()[0];
    assert.equal(plan.repair_required, false);
    assert.deepEqual(plan.financing, financingAmounts(terms));
    assert.deepEqual(
      plan.entries.map((row) => row.amount_cents),
      [5125, 5125],
    );
    const confirmed = f.recurrences.month('2026-10').occurrences[0];
    assert.equal(confirmed.state, 'confirmed');
    assert.equal(confirmed.amount_cents, 10250);
    assert.equal(f.statements.get('2026-10').expense, 0);
    const next = f.recurrences.month('2026-11').occurrences[0];
    assert.equal(next.state, 'unconfirmed');
    assert.equal(next.amount_cents, 10000);
    assert.equal(next.payment_id, defaults.payment_id);
    f.recurrences.boundary({
      recurrence_id: recurrence,
      last_retained_date: slot.scheduled_date,
      action: 'end',
    });
    assert.equal(f.statements.get('2026-11').expense, 51.25);
    assert.equal(f.statements.get('2026-12').expense, 51.25);
    assert.equal(f.statements.get('2027-01').openingBalance, -102.5);
    assert.throws(() => f.transactions.remove(id), /installment_managed/);
    const deletion = f.plans.previewRemove(plan.id);
    f.plans.remove(plan.id, deletion.correction.token);
    assert.equal(
      f.recurrences.month('2026-10').occurrences[0].state,
      'ignored',
    );
    assert.equal(f.statements.get('2026-11').expense, 0);
    assert.equal(
      f.db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.installment_id, plan.id))
        .all().length,
      0,
    );
    assert.deepEqual(
      f.db.$client.prepare('PRAGMA foreign_key_check').all(),
      [],
    );
  } finally {
    f.db.$client.close();
  }
});

test('future single invoices and uneven plans preserve totals, rate provenance and authoritative statements', () => {
  const f = fixture();
  try {
    const input = {
      name: 'Payment',
      type: 2 as const,
      amount_cents: 10250,
      financing: terms,
      reference_date: '2026-10-05',
      payment_date: null,
      user_id: f.profiles.requireActive().id,
      category_id: null,
      payment_id: f.method('pix_credit'),
      card_id: f.card,
      invoice_month: '2026-11',
    };
    const preview = f.transactions.previewCreate(input)!;
    assert.equal(f.db.select().from(creditCardInvoicesTable).all().length, 0);
    f.transactions.create({ ...input, correction_token: preview.token });
    assert.equal(f.statements.get('2026-10').expense, 0);
    assert.equal(f.statements.get('2026-11').expense, 102.5);
    const draft: InstallmentInput = {
      request_id: 'uneven-financing-request-0001',
      name: 'Uneven',
      note: null,
      total_amount_cents: 10250,
      total_installments: 3,
      financing: terms,
      payment_id: f.method('boleto_credit'),
      card_id: f.card,
      category_id: null,
      purchase_at: '2026-10-05',
      start_date: '2026-10-05',
      first_invoice_month: '2026-12',
      invoice_ids: [],
      installment_amounts_cents: [1, 3999, 6250],
      historical_card: false,
    };
    const proposed = f.plans.preview(draft);
    assert.throws(
      () =>
        f.plans.create(
          {
            ...draft,
            financing: { ...terms, interest: { mode: 'amount', value: 200 } },
          },
          proposed.correction.token,
        ),
      /stale_correction/,
    );
    const id = f.plans.create(draft, proposed.correction.token);
    assert.equal(f.plans.create(draft, proposed.correction.token), id);
    const saved = f.plans.list()[0];
    assert.deepEqual(saved.financing, financingAmounts(terms));
    assert.deepEqual(
      saved.entries.map((row) => row.amount_cents),
      [1, 3999, 6250],
    );
    assert.equal(saved.repair_required, false);
    assert.equal(f.statements.get('2026-12').expense, 0.01);
    assert.equal(f.statements.get('2027-01').expense, 39.99);
    assert.equal(f.statements.get('2027-02').expense, 62.5);
    const statement = f.cards.registerInvoice(f.card, {
      ...f.cards.previewPeriod(f.card, '2027-04'),
      amount_cents: 30000,
      total_source: 'statement',
    });
    const statementInput = {
      ...input,
      invoice_month: null,
      credit_card_invoice_id: statement,
    };
    const correction = f.transactions.previewCreate(statementInput)!;
    f.transactions.create({
      ...statementInput,
      correction_token: correction.token,
    });
    assert.equal(f.cards.invoiceSummary(statement).amount_cents, 30000);
    assert.equal(f.statements.get('2027-04').expense, 300);
  } finally {
    f.db.$client.close();
  }
});
