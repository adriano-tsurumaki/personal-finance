import { getLocale, t } from '@lib/i18n';

/** Sums integer cents, returning null when the overview cannot be represented exactly. */
export function sumInstallmentCents(
  rows: { amount_cents: number }[],
): number | null {
  const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  return Number.isSafeInteger(total) ? total : null;
}

export function planDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(getLocale(), {
    timeZone: 'UTC',
  });
}

export function installmentError(error: unknown): string {
  const message = String(error);

  if (message.includes('installment_credit_required')) {
    return t('installments.credit_required');
  }

  if (message.includes('invalid_installment_allocation')) {
    return t('installments.allocation_error');
  }

  if (message.includes('invalid_installment_invoice_dates')) {
    return t('installments.invoice_date_error');
  }

  if (message.includes('stale_correction')) {
    return t('installments.stale');
  }

  if (message.includes('installment_paid')) {
    return t('installments.paid_error');
  }

  if (message.includes('installment_repair_required')) {
    return t('installments.repair');
  }

  if (message.includes('installment_request_conflict')) {
    return t('installments.request_conflict');
  }

  if (message.includes('invoice') || message.includes('card')) {
    return t('installments.invoice_error');
  }

  return t('installments.action_error');
}
