import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  invoiceSelection,
  installmentInvoiceSelection,
} from './invoice-selection';

test('switching from credit to a direct payment clears invoice choices before confirmation', () => {
  const selected = invoiceSelection(true, '2026-11', 42);
  assert.equal(selected.invoice_month, '2026-11');
  assert.equal(selected.credit_card_invoice_id, 42);

  const direct = invoiceSelection(
    false,
    selected.invoice_month,
    selected.credit_card_invoice_id,
  );
  assert.deepEqual(direct, {
    invoice_month: null,
    credit_card_invoice_id: null,
  });
  assert.deepEqual(
    invoiceSelection(true, direct.invoice_month, direct.credit_card_invoice_id),
    direct,
  );
});

test('installment handoff retains an explicit invoice or closing month instead of reverting to automatic selection', () => {
  assert.deepEqual(installmentInvoiceSelection(null, 42), {
    first_invoice_month: null,
    invoice_ids: [42],
  });
  assert.deepEqual(installmentInvoiceSelection('2026-11', null), {
    first_invoice_month: '2026-11',
    invoice_ids: [],
  });
  assert.deepEqual(installmentInvoiceSelection(null, null), {
    first_invoice_month: null,
    invoice_ids: [],
  });
});
