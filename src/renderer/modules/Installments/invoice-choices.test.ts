import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  InvoiceDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import { loadFirstInvoiceChoices } from './invoice-choices';

function period(closing: string, due: string): InvoicePeriodDto {
  return {
    opening_date: `${closing.slice(0, 7)}-01`,
    closing_date: closing,
    due_date: due,
    includes_closing_day: false,
  };
}

test('deferral choices use the purchase invoice and persisted due dates, including months after year-end', async () => {
  const calls: string[] = [];
  const choices = await loadFirstInvoiceChoices(
    {
      async suggestInvoicePeriod(cardId, date) {
        assert.equal(cardId, 3);
        assert.equal(date, '2026-11-30');
        // A purchase on an excluded closing day starts in the following invoice.
        return period('2026-12-31', '2027-01-07');
      },
      async previewInvoicePeriod(cardId, month) {
        assert.equal(cardId, 3);
        calls.push(month);
        assert.equal(month, '2027-02');
        return period('2027-02-28', '2027-03-07');
      },
    },
    3,
    '2026-11-30',
    [
      {
        ...period('2027-01-31', '2027-02-10'),
        id: 9,
        credit_card_id: 3,
        total_source: 'calculated',
        amount_cents: 0,
        items_total_cents: 0,
        difference_cents: 0,
        paid_at: null,
      },
    ],
  );
  assert.deepEqual(choices, [
    { month: '2026-12', dueDate: '2027-01-07' },
    { month: '2027-01', dueDate: '2027-02-10' },
    { month: '2027-02', dueDate: '2027-03-07' },
  ]);
  assert.deepEqual(calls, ['2027-02']);
});

test('ambiguous or unavailable periods fail instead of displaying a misleading due date', async () => {
  const api = {
    async suggestInvoicePeriod() {
      return period('2026-08-31', '2026-09-07');
    },
    async previewInvoicePeriod(): Promise<InvoicePeriodDto> {
      throw new Error('unavailable');
    },
  };
  await assert.rejects(
    loadFirstInvoiceChoices(api, 3, '2026-08-17', []),
    /unavailable/,
  );
  const invoice = { ...period('2026-09-30', '2026-10-07') } as InvoiceDto;
  await assert.rejects(
    loadFirstInvoiceChoices(api, 3, '2026-08-17', [invoice, invoice]),
    /ambiguous_invoice/,
  );
});
