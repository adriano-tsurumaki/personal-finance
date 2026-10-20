import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '@store/transaction';
import { setLocale } from '@lib/i18n';
import CashFlow from './CashFlow';
import { referenceChart } from './reference-chart';
import MonthlyTimeline from '../TimelineTransaction/MonthlyTimeline';
import { referenceSummary } from '../TimelineTransaction/reference-summary';
import type { TransactionDto } from '@shared/contracts/transaction';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';

test('reference totals include credit purchases and only unconfirmed estimates', () => {
  const transactions = [
    { type: 1, amount_cents: 10001 },
    { type: 2, amount_cents: 2050, credit_card_invoice_id: 7 },
  ] as TransactionDto[];
  const occurrences = [
    { type: 2, amount_cents: 1000, state: 'unconfirmed' },
    { type: 1, amount_cents: 10001, state: 'confirmed' },
    { type: 2, amount_cents: 900, state: 'ignored' },
  ] as RecurrenceOccurrenceDto[];
  assert.deepEqual(referenceSummary(transactions, occurrences), {
    income: 100.01,
    expense: 30.5,
    net: 69.51,
  });
  assert.equal(
    referenceSummary(
      [
        { type: 1, amount_cents: Number.MAX_SAFE_INTEGER },
        { type: 1, amount_cents: 1 },
      ] as TransactionDto[],
      [],
    ),
    null,
  );
});

test('reference chart includes credit and settled entries regardless of payment month and carries daily results', () => {
  const transactions = [
    {
      id: 1,
      name: 'Income',
      type: 1,
      amount_cents: 10001,
      reference_date: '2024-02-01',
      payment_date: '2024-03-05',
    },
    {
      id: 2,
      name: 'Credit purchase',
      type: 2,
      amount_cents: 2050,
      reference_date: '2024-02-10',
      payment_date: null,
      credit_card_invoice_id: 7,
    },
    {
      id: 3,
      name: 'Prior reference',
      type: 1,
      amount_cents: 8000,
      reference_date: '2024-01-10',
      payment_date: '2024-02-10',
    },
    {
      id: 4,
      name: 'Already paid',
      type: 2,
      amount_cents: 1000,
      reference_date: '2024-02-10',
      payment_date: '2024-01-31',
    },
  ] as TransactionDto[];
  const occurrences = [
    {
      recurrence_id: 1,
      name: 'Estimate',
      type: 2,
      amount_cents: 500,
      state: 'unconfirmed',
      scheduled_date: '2024-02-15',
    },
    {
      recurrence_id: 2,
      name: 'Confirmed',
      type: 1,
      amount_cents: 10001,
      state: 'confirmed',
      scheduled_date: '2024-02-01',
    },
  ] as RecurrenceOccurrenceDto[];
  const chart = referenceChart('2024-02', transactions, occurrences);
  assert.equal(chart.events.length, 4);
  assert.equal(chart.balanceSeries.length, 29);
  assert.equal(chart.balanceSeries[0].balance, 100.01);
  assert.equal(chart.balanceSeries[9].balance, 69.51);
  assert.equal(chart.balanceSeries[28].balance, 64.51);
  assert.equal(chart.balanceSeries[28].balance, chart.summary!.net);
  assert.equal(
    referenceChart('2024-03', transactions, occurrences).balanceSeries[0]
      .balance,
    0,
  );
});

test('reference chart remains available outside the cash-flow reporting boundary and excludes invoice settlements', () => {
  const snapshot = useAppStore.getInitialState();
  const original = { ...snapshot };
  setLocale('en-US');
  try {
    Object.assign(snapshot, {
      monthKey: '2026-10',
      statementLoaded: false,
      statementIssue: 'before_indicator_anchor',
      transactionsLoading: false,
      transactionsFailed: false,
      transactions: [
        {
          id: 1,
          name: 'Future invoice purchase',
          type: 2,
          amount_cents: 80000,
          reference_date: '2026-10-15',
          payment_date: null,
          credit_card_invoice_id: 2,
        },
      ],
      invoicePayments: [
        {
          invoice_id: 1,
          card_name: 'Separate settlement',
          amount_cents: 120000,
          paid_at: '2026-10-07',
        },
      ],
      recurrenceMonth: null,
    });
    const html = renderToStaticMarkup(<CashFlow initialBasis="reference" />);
    assert.match(html, /Future invoice purchase/);
    assert.match(html, /Cumulative reference-date result/);
    assert.match(html, /Starts at zero/);
    assert.doesNotMatch(html, /Separate settlement|before the starting point/);
    assert.doesNotMatch(html, /Expected inflows|Expected outflows/);
    snapshot.transactionsFailed = true;
    const failed = renderToStaticMarkup(<CashFlow initialBasis="reference" />);
    assert.doesNotMatch(failed, /Future invoice purchase/);
    assert.match(failed, /Cash flow is unavailable/);
  } finally {
    Object.assign(snapshot, original);
    setLocale('pt-BR');
  }
});

test('cash-flow view labels movements in both locales and hides stale details when unavailable', () => {
  const snapshot = useAppStore.getInitialState();
  const original = { ...snapshot };
  try {
    Object.assign(snapshot, {
      statementLoaded: true,
      statementLoading: false,
      monthlyStatement: {
        ...original.monthlyStatement,
        closingBalance: -123,
        expense: 123,
        balanceSeries: [
          { date: '2026-10-01', balance: 0 },
          { date: '2026-10-31', balance: -123 },
        ],
        cashFlowEvents: [
          {
            id: 'invoice_due:1',
            kind: 'invoice_due',
            name: 'Sample card',
            date: '2026-10-15',
            income: 0,
            expense: 123,
          },
        ],
      },
    });
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(<CashFlow />);
      assert.match(html, /Sample card/);
      assert.match(html, /dateTime="2026-10-15"/);
      assert.match(
        html,
        locale === 'en-US' ? /Invoice due/ : /Vencimento de fatura/,
      );
      const tabs = renderToStaticMarkup(<MonthlyTimeline />);
      assert.match(tabs, /role="tablist"/);
      assert.match(tabs, locale === 'en-US' ? /Cash flow/ : /Fluxo de caixa/);
    }
    snapshot.statementLoaded = false;
    snapshot.statementIssue = 'before_indicator_anchor';
    const unavailable = renderToStaticMarkup(<CashFlow />);
    assert.doesNotMatch(unavailable, /Sample card|<svg[^>]*role="img"/);
    assert.match(unavailable, /anterior ao ponto inicial/);
    assert.equal((unavailable.match(/—/g) ?? []).length, 0);
  } finally {
    Object.assign(snapshot, original);
    setLocale('pt-BR');
  }
});
