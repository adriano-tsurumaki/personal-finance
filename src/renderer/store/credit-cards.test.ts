import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCreditCardStore } from './credit-cards';
import type {
  CreditCardDto,
  InvoiceDetailsDto,
} from '@shared/contracts/credit-cards';

test('card navigation rejects stale profile responses and remains independent of reporting months', async () => {
  let resolve!: (rows: CreditCardDto[]) => void;
  const store = createCreditCardStore(() => ({
    getCreditCards: () =>
      new Promise((done) => {
        resolve = done;
      }),
    getUnlinkedCreditEntries: async () => [],
    getCardInvoices: async () => [],
    getInvoiceDetails: async () => {
      throw new Error('unused');
    },
  }));
  const loading = store.getState().selectCard(1);
  store.getState().reset();
  resolve([
    {
      id: 1,
      name: 'Old session',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
      archived_at: null,
    },
  ]);
  await loading;
  assert.deepEqual(store.getState().cards, []);
  assert.equal(store.getState().cardId, null);
  const oldPeriod = store.getState().periodMonth;
  store.getState().setPeriodMonth('2024-01');
  assert.notEqual(store.getState().periodMonth, oldPeriod);
  assert.equal(store.getState().invoiceId, null);
});

test('a late invoice request cannot replace the newly selected invoice', async () => {
  const pending = new Map<number, (value: InvoiceDetailsDto) => void>();
  const store = createCreditCardStore(() => ({
    getCreditCards: async () => [],
    getUnlinkedCreditEntries: async () => [],
    getCardInvoices: async () => [],
    getInvoiceDetails: (id) =>
      new Promise((done) => {
        pending.set(id, done);
      }),
  }));
  const first = store.getState().selectInvoice(1);
  const second = store.getState().selectInvoice(2);
  const details = (id: number): InvoiceDetailsDto => ({
    invoice: {
      id,
      credit_card_id: 1,
      opening_date: '2024-09-21',
      closing_date: '2024-10-20',
      due_date: '2024-10-27',
      includes_closing_day: true,
      total_source: 'calculated',
      amount_cents: 0,
      items_total_cents: 0,
      difference_cents: 0,
      paid_at: null,
    },
    entries: [],
    history: [],
  });
  pending.get(2)!(details(2));
  await second;
  pending.get(1)!(details(1));
  await first;
  assert.equal(store.getState().details?.invoice.id, 2);
});
