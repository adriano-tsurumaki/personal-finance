import type { RecurrenceDefaults } from '@shared/contracts/recurrence';
import type { ProfileOptionsDto } from '@shared/contracts/profile-catalog';
import type { CreditCardDto } from '@shared/contracts/credit-cards';
import { paymentMethodsForType } from '@shared/lib/payment-method';
import type { TranslationKey } from '@lib/i18n';

/** Renderer field feedback; main independently revalidates all submitted defaults. */
export function validateDefaults(
  values: RecurrenceDefaults,
  options: ProfileOptionsDto,
  cards: CreditCardDto[],
): Partial<Record<keyof RecurrenceDefaults, TranslationKey>> {
  const errors: Partial<Record<keyof RecurrenceDefaults, TranslationKey>> = {};

  if (!values.name.trim()) {
    errors.name = 'recurrence.invalid_title';
  }

  if (!Number.isSafeInteger(values.amount_cents) || values.amount_cents <= 0) {
    errors.amount_cents = 'recurrence.invalid_amount';
  }

  if (
    !options.categories.some(
      (row) =>
        row.id === values.category_id &&
        (!row.transaction_type ||
          row.transaction_type === 'both' ||
          row.transaction_type === (values.type === 1 ? 'income' : 'expense')),
    )
  ) {
    errors.category_id = 'recurrence.invalid_category';
  }

  const payment = options.payments.find((row) => row.id === values.payment_id);

  if (
    !payment ||
    !paymentMethodsForType(values.type).includes(payment.catalog_key)
  ) {
    errors.payment_id = 'recurrence.invalid_payment';
  }

  if (
    payment?.catalog_key === 'credit' &&
    !cards.some(
      (card) => card.id === values.credit_card_id && !card.archived_at,
    )
  ) {
    errors.credit_card_id = 'recurrence.invalid_card';
  }

  return errors;
}
