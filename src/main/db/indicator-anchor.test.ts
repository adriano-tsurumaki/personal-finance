import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createIndicatorAnchorService } from '../indicator-anchor';
import { createTransactionService } from '../transactions';
import { createMonthlyStatementService } from '../monthly-statement';
import { createFinancialMonthService } from '../financial-month';
import { createCreditCardService } from '../credit-cards';
import { createRecurrenceService } from '../recurrences';
import { createInstallmentService } from '../installments';
import {
  creditCardInvoicesTable,
  recurrencesTable,
  transactionsTable,
} from './schema';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';

function fixture(filename = ':memory:', migrations = resolve('drizzle')) {
  const db = initDb(filename, migrations);
  const profiles = createProfileService(db);
  const owner = profiles.create({
    name: 'Owner',
    email: 'anchor@example.test',
    locale: 'en-US',
  });
  assert.ok(owner.ok);
  const active = () => profiles.requireActive();
  const anchors = createIndicatorAnchorService(db, active);
  const statements = createMonthlyStatementService(db, active);
  const months = createFinancialMonthService(db, active);
  const transactions = createTransactionService(db, active);
  const cards = createCreditCardService(db, active);
  const recurrences = createRecurrenceService(db, active);
  const method = (key: string) =>
    profiles.options().payments.find((row) => row.catalog_key === key)!.id;
  const direct = (
    date: string,
    cents: number,
    type: 1 | 2 = 2,
    paid: string | null = null,
  ) =>
    transactions.create({
      name: 'Direct entry',
      type,
      amount_cents: cents,
      reference_date: date,
      payment_date: paid,
      user_id: active().id,
      payment_id: method('pix'),
      category_id: null,
    });
  return {
    db,
    profiles,
    active,
    anchors,
    statements,
    months,
    transactions,
    cards,
    recurrences,
    method,
    direct,
  };
}

test('inclusive partial-month anchors replace history with a baseline without creating income', () => {
  const f = fixture();
  try {
    f.direct('2025-12-31', 90000, 1);
    f.direct('2026-10-09', 20000);
    f.direct('2026-10-10', 10000);
    f.direct('2026-10-11', 20000, 1);
    assert.equal(f.statements.get('2026-10').closingBalance, 800);
    const history = f.db.select().from(transactionsTable).all();
    f.anchors.save({ start_date: '2026-10-10', opening_balance_cents: 50000 });
    const result = f.statements.get('2026-10');
    assert.equal(result.openingBalance, 500);
    assert.equal(result.closingBalance, 600);
    assert.equal(result.income, 200);
    assert.equal(result.expense, 100);
    assert.equal(result.net, 100);
    assert.equal(result.savingsRate, 0.5);
    assert.equal(result.balanceSeries[0].date, '2026-10-10');
    assert.equal(result.balanceSeries[0].balance, 400);
    assert.equal(result.balanceSeries.length, 22);
    assert.equal(f.statements.get('2027-01').openingBalance, 600);
    const excluded = f.months.get('2026-09');
    assert.equal(excluded.statement, null);
    assert.equal(excluded.statement_issue, 'before_indicator_anchor');
    assert.equal(excluded.indicator_anchor?.start_date, '2026-10-10');
    assert.equal(f.months.get('2026-10').transactions.length, 3);
    assert.deepEqual(f.db.select().from(transactionsTable).all(), history);
    f.anchors.remove();
    assert.equal(f.statements.get('2026-10').closingBalance, 800);
    assert.equal(f.months.get('2026-09').statement_issue, null);
  } finally {
    f.db.$client.close();
  }
});

test('signed baselines, leap dates, empty periods and safe-cent overflow are handled explicitly', () => {
  const f = fixture();
  try {
    for (const cents of [-12000, 0, 12000]) {
      f.anchors.save({
        start_date: '2024-02-29',
        opening_balance_cents: cents,
      });
      const result = f.statements.get('2024-02');
      assert.equal(result.closingBalance, cents / 100);
      assert.deepEqual(result.balanceSeries, [
        { date: '2024-02-29', balance: cents / 100 },
      ]);
      assert.equal(f.statements.get('2025-01').openingBalance, cents / 100);
      assert.equal(result.savingsRate, 0);
    }
    for (const date of [
      '2023-02-29',
      '2024-02-30',
      '2026-00-01',
      '2026-13-01',
      '0000-01-01',
      '2026-10-00',
      '2026-10-32',
      'invalid',
    ]) {
      assert.throws(
        () => f.anchors.save({ start_date: date, opening_balance_cents: 0 }),
        /Invalid indicator/,
      );
    }
    for (const cents of [NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(
        () =>
          f.anchors.save({
            start_date: '2026-01-01',
            opening_balance_cents: cents,
          }),
        /Invalid indicator/,
      );
    }
    assert.throws(
      () => f.anchors.save(null as unknown as IndicatorAnchorDto),
      /Invalid indicator/,
    );
    f.anchors.save({
      start_date: '2026-01-01',
      opening_balance_cents: Number.MAX_SAFE_INTEGER,
    });
    f.direct('2026-01-01', 1, 1);
    assert.throws(() => f.statements.get('2026-01'), /supported amount/);
  } finally {
    f.db.$client.close();
  }
});

test('offsetting historical flows preserve anchored balances at both safe-cent limits', () => {
  for (const baseline of [
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER,
  ]) {
    for (const amount of [3, 4]) {
      const f = fixture();
      try {
        f.anchors.save({
          start_date: '2026-01-01',
          opening_balance_cents: baseline,
        });
        f.direct('2026-01-02', amount, 1);
        f.direct('2026-01-02', amount, 2);
        const january = f.statements.get('2026-01');
        const february = f.statements.get('2026-02');
        assert.equal(january.closingBalance, baseline / 100);
        assert.equal(february.openingBalance, baseline / 100);
        assert.equal(february.closingBalance, january.closingBalance);
        assert.ok(
          february.balanceSeries.every((day) => day.balance === baseline / 100),
        );
      } finally {
        f.db.$client.close();
      }
    }
  }
});

test('historical opening balances outside either safe-cent limit are rejected', () => {
  for (const type of [1, 2] as const) {
    const f = fixture();
    try {
      f.anchors.save({
        start_date: '2026-01-01',
        opening_balance_cents:
          type === 1 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER,
      });
      f.direct('2026-01-02', 1, type);
      assert.throws(() => f.statements.get('2026-02'), /supported amount/);
    } finally {
      f.db.$client.close();
    }
  }
});

test('settings are profile-owned and upgrade/restart preserves financial rows and selections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-anchor-upgrade-'));
  const filename = join(directory, 'history.db');
  const folder = join(directory, 'migrations');
  mkdirSync(folder);
  const migrations = readdirSync(resolve('drizzle')).sort();
  const latest = migrations.find((name) =>
    name.endsWith('_indicator_anchors'),
  )!;
  let db: ReturnType<typeof initDb> | undefined;
  try {
    for (const name of migrations.filter((name) => name < latest)) {
      cpSync(join(resolve('drizzle'), name), join(folder, name), {
        recursive: true,
      });
    }
    const f = fixture(filename, folder);
    db = f.db;
    f.direct('2026-01-01', 12345, 1);
    const ownerId = f.active().id;
    const rows = db.select().from(transactionsTable).all();
    db.$client.close();
    db = initDb(filename, resolve('drizzle'));
    const profiles = createProfileService(db);
    const active = () => profiles.requireActive();
    const anchors = createIndicatorAnchorService(db, active);
    assert.equal(anchors.get(), null);
    const anchor = { start_date: '2026-10-10', opening_balance_cents: -12345 };
    anchors.save({ ...anchor, user_id: 999 } as IndicatorAnchorDto);
    const second = profiles.create({
      name: 'Second',
      email: 'second@example.test',
      locale: 'en-US',
    });
    assert.ok(second.ok);
    assert.equal(anchors.get(), null);
    anchors.remove();
    anchors.save({ start_date: '2026-11-01', opening_balance_cents: 0 });
    profiles.enter(ownerId);
    assert.deepEqual(anchors.get(), anchor);
    assert.deepEqual(db.select().from(transactionsTable).all(), rows);
    const statements = createMonthlyStatementService(db, active);
    assert.equal(statements.get('2026-10').closingBalance, -123.45);
    const externalDb = initDb(filename, resolve('drizzle'));
    try {
      const external = createIndicatorAnchorService(externalDb, () => ({
        id: ownerId,
      }));
      external.save({ ...anchor, opening_balance_cents: 34567 });
      assert.equal(statements.get('2026-10').closingBalance, 345.67);
      external.remove();
      assert.equal(statements.get('2026-10').closingBalance, 123.45);
      external.save(anchor);
      assert.equal(statements.get('2026-10').closingBalance, -123.45);
    } finally {
      externalDb.$client.close();
    }
    db.$client.close();
    db = initDb(filename, resolve('drizzle'));
    const restarted = createProfileService(db);
    assert.deepEqual(
      createIndicatorAnchorService(db, () => restarted.requireActive()).get(),
      anchor,
    );
    restarted.leave();
    assert.throws(
      () =>
        createIndicatorAnchorService(db!, () =>
          restarted.requireActive(),
        ).get(),
      /No active profile/,
    );
  } finally {
    db?.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('effective payment dates and authoritative invoice totals cross the boundary once', () => {
  const f = fixture();
  try {
    f.anchors.save({ start_date: '2026-10-10', opening_balance_cents: 100000 });
    f.direct('2026-09-01', 20000, 1, '2026-10-10');
    f.direct('2026-10-15', 90000, 1, '2026-10-09');
    const card = f.cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const invoice = f.cards.registerInvoice(card, {
      ...f.cards.previewPeriod(card, '2026-09'),
      due_date: '2026-10-10',
      total_source: 'statement',
      amount_cents: 30000,
    });
    f.db
      .insert(transactionsTable)
      .values({
        name: 'Older invoice detail',
        type: 2,
        amount_cents: 10000,
        reference_date: '2026-09-10',
        payment_date: null,
        user_id: f.active().id,
        category_id: null,
        payment_id: f.method('credit'),
        credit_card_invoice_id: invoice,
      })
      .run();
    assert.equal(f.statements.get('2026-10').income, 200);
    assert.equal(f.statements.get('2026-10').expense, 300);
    assert.equal(f.statements.get('2026-10').closingBalance, 900);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-10-09' })
      .where(eq(creditCardInvoicesTable.id, invoice))
      .run();
    assert.equal(f.statements.get('2026-10').expense, 0);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-11-02' })
      .where(eq(creditCardInvoicesTable.id, invoice))
      .run();
    assert.equal(f.statements.get('2026-10').closingBalance, 1200);
    assert.equal(f.statements.get('2026-11').expense, 300);
    assert.equal(f.statements.get('2026-11').closingBalance, 900);
  } finally {
    f.db.$client.close();
  }
});

test('direct recurrence history and confirmed/ignored slots respect the cash-flow lower bound', () => {
  const f = fixture();
  try {
    const defaults = {
      name: 'Monthly receipt',
      type: 1 as const,
      amount_cents: 10000,
      category_id: null,
      payment_id: f.method('pix'),
      credit_card_id: null,
      start_date: '2026-01-10',
      frequency: 3 as const,
      interval: 1,
    };
    const id = f.recurrences.create(defaults);
    f.recurrences.ignore({ recurrence_id: id, scheduled_date: '2026-10-10' });
    const slot = f.recurrences.month('2026-11').occurrences[0];
    f.recurrences.confirm({
      ...defaults,
      recurrence_id: id,
      scheduled_date: slot.scheduled_date,
      expected_version_id: slot.version_id,
      reference_date: '2026-11-10',
    });
    f.anchors.save({ start_date: '2026-10-10', opening_balance_cents: -5000 });
    assert.equal(f.statements.get('2026-10').closingBalance, -50);
    assert.equal(f.statements.get('2026-11').income, 100);
    assert.equal(f.statements.get('2026-12').openingBalance, 50);
    assert.equal(f.statements.get('2026-12').closingBalance, 150);
    f.anchors.save({ start_date: '2026-10-11', opening_balance_cents: 0 });
    assert.equal(f.statements.get('2026-10').income, 0);
  } finally {
    f.db.$client.close();
  }
});

test('credit recurrence estimates retain older purchases due after the anchor and drop earlier coverage issues', () => {
  const f = fixture();
  try {
    const card = f.cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const id = f.recurrences.create({
      name: 'Subscription',
      type: 2,
      amount_cents: 10000,
      category_id: null,
      payment_id: f.method('credit'),
      credit_card_id: card,
      start_date: '2026-03-12',
      frequency: 3,
      interval: 1,
    });
    const invoice = f.cards.registerInvoice(card, {
      ...f.cards.previewPeriod(card, '2026-03'),
      total_source: 'statement',
      amount_cents: 30000,
    });
    f.anchors.save({ start_date: '2026-04-05', opening_balance_cents: 100000 });
    assert.equal(f.statements.get('2026-04').expense, 0);
    assert.equal(f.statements.get('2026-05').expense, 100);
    assert.equal(f.statements.get('2026-05').closingBalance, 900);
    f.anchors.save({ start_date: '2026-04-04', opening_balance_cents: 100000 });
    assert.equal(f.months.get('2026-04').statement, null);
    assert.match(f.months.get('2026-04').statement_issue!, /coverage/);
    f.recurrences.coverage({
      recurrence_id: id,
      scheduled_date: '2026-03-12',
      credit_card_invoice_id: invoice,
      status: 'included',
    });
    assert.equal(f.statements.get('2026-04').expense, 300);
    f.db
      .update(creditCardInvoicesTable)
      .set({ paid_at: '2026-06-01' })
      .where(eq(creditCardInvoicesTable.id, invoice))
      .run();
    assert.equal(f.statements.get('2026-04').expense, 0);
    assert.equal(f.statements.get('2026-06').expense, 400);
    const writes = f.db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    f.statements.get('2030-01');
    assert.equal(
      f.db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      writes,
    );
  } finally {
    f.db.$client.close();
  }
});

test('unknown legacy recurrence dates remain unavailable after the boundary', () => {
  const f = fixture();
  try {
    f.db
      .insert(recurrencesTable)
      .values({
        name: 'Unknown legacy rule',
        user_id: f.active().id,
        status: 'repair_required',
        anchor_date: null,
      })
      .run();
    f.anchors.save({ start_date: '2026-10-01', opening_balance_cents: 0 });
    assert.equal(f.months.get('2026-10').statement, null);
    assert.equal(
      f.months.get('2026-10').statement_issue,
      'recurrence_repair_required',
    );
    assert.equal(
      f.months.get('2026-09').statement_issue,
      'before_indicator_anchor',
    );
  } finally {
    f.db.$client.close();
  }
});

test('installment invoices survive the reporting boundary without filtering their purchase plan', () => {
  const f = fixture();
  try {
    const card = f.cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const plans = createInstallmentService(f.db, f.active);
    const input = {
      request_id: 'anchor-plan-request-0001',
      name: 'Purchase',
      note: null,
      total_amount_cents: 30000,
      total_installments: 3,
      purchase_at: '2026-08-10',
      start_date: '2026-08-10',
      payment_id: f.method('credit'),
      category_id: null,
      card_id: card,
      historical_card: false,
      invoice_ids: [null, null, null],
    };
    const preview = plans.preview(input);
    plans.create(input, preview.correction.token);
    const before = plans.list();
    f.anchors.save({ start_date: '2026-10-01', opening_balance_cents: 50000 });
    assert.equal(f.statements.get('2026-10').expense, 100);
    assert.equal(f.statements.get('2026-11').expense, 100);
    assert.equal(f.statements.get('2026-11').closingBalance, 300);
    assert.deepEqual(plans.list(), before);
  } finally {
    f.db.$client.close();
  }
});
