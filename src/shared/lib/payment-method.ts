import type { PaymentMethodKey } from '../contracts/profile-catalog';

/** Catalog methods allowed for a new entry or a change of transaction type. */
export function paymentMethodsForType(type: 1 | 2 | null): PaymentMethodKey[] {
  if (type === 1) {
    return ['pix', 'cash', 'bank_transfer'];
  }

  if (type === 2) {
    return ['pix', 'cash', 'debit', 'credit'];
  }

  return [];
}
