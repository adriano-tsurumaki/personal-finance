import type { PaymentMethodKey } from '../contracts/profile-catalog';

/** Catalog methods allowed for a new entry or a change of transaction type. */
export function paymentMethodsForType(type: 1 | 2 | null): PaymentMethodKey[] {
  if (type === 1) {
    return ['pix', 'cash', 'bank_transfer'];
  }

  if (type === 2) {
    return ['pix', 'cash', 'debit', 'credit', 'pix_credit', 'boleto_credit'];
  }

  return [];
}

export function isCreditPayment(key: string | null | undefined): boolean {
  return key === 'credit' || isFinancedPayment(key);
}

export function isFinancedPayment(key: string | null | undefined): boolean {
  return key === 'pix_credit' || key === 'boleto_credit';
}
