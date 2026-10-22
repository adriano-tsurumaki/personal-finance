import { isCreditPayment } from '@shared/lib/payment-method';
import { useId } from 'react';
import {
  FieldSelect,
  Field,
  FieldLabel,
  FieldMoney,
  FieldError,
} from '@components/ui/field';
import { Input } from '@components/ui/input';
import { categoryLabel, getLocale, t } from '@lib/i18n';
import { useProfileStore } from '@store/profile';
import { paymentMethodsForType } from '@shared/lib/payment-method';
import type { CreditCardDto } from '@shared/contracts/credit-cards';

export interface DefaultValues {
  name: string;
  type: 1 | 2;
  amount_cents: number;
  category_id: number | null;
  payment_id: number;
  credit_card_id: number | null;
}

export default function DefaultFields({
  value,
  onChange,
  cards,
  fixedType = false,
  amountReadOnly = false,
  errors = {},
}: {
  value: DefaultValues;
  onChange: (next: DefaultValues) => void;
  cards: CreditCardDto[];
  fixedType?: boolean;
  amountReadOnly?: boolean;
  errors?: Partial<Record<keyof DefaultValues, string>>;
}) {
  const prefix = useId();
  const options = useProfileStore((state) => state.options);
  const credit = isCreditPayment(
    options.payments.find((row) => row.id === value.payment_id)?.catalog_key,
  );
  const categories = options.categories.filter(
    (row) =>
      !row.transaction_type ||
      row.transaction_type === 'both' ||
      row.transaction_type === (value.type === 1 ? 'income' : 'expense'),
  );
  const payments = options.payments.filter((row) =>
    paymentMethodsForType(value.type).includes(row.catalog_key),
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${prefix}-name`}>
          {t('transactions.name')}
        </FieldLabel>
        <Input
          id={`${prefix}-name`}
          required
          autoFocus
          aria-invalid={!!errors.name}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
        <FieldError>{errors.name}</FieldError>
      </Field>
      <FieldMoney
        disabled={amountReadOnly}
        label={t('transactions.amount')}
        decimalSeparator={getLocale() === 'en-US' ? '.' : ','}
        error={errors.amount_cents}
        money={value.amount_cents / 100}
        onMoneyChange={(amount) =>
          onChange({ ...value, amount_cents: Math.round(amount * 100) })
        }
      />
      <FieldSelect
        label={t('transactions.type')}
        value={value.type}
        options={[
          { value: 1, label: t('transactions.income') },
          { value: 2, label: t('transactions.expense') },
        ]}
        disabled={fixedType}
        onValueChange={(type) =>
          onChange({
            ...value,
            type: type === 1 ? 1 : 2,
            category_id: null,
            payment_id: 0,
            credit_card_id: null,
          })
        }
      />
      <FieldSelect
        label={t('transactions.category')}
        value={value.category_id}
        options={categories.map((row) => ({
          value: row.id,
          label: categoryLabel(row),
        }))}
        onValueChange={(id) =>
          onChange({ ...value, category_id: Number(id) || null })
        }
        placeholder={t('transactions.select_category')}
        error={errors.category_id}
      />
      <FieldSelect
        label={t('transactions.payment')}
        value={value.payment_id || null}
        options={payments.map((row) => ({
          value: row.id,
          label: t(`payments.${row.catalog_key}`),
        }))}
        onValueChange={(id) =>
          onChange({
            ...value,
            payment_id: Number(id) || 0,
            credit_card_id: null,
          })
        }
        placeholder={t('transactions.select_payment')}
        error={errors.payment_id}
      />
      {credit && (
        <FieldSelect
          label={t('cards.card')}
          value={value.credit_card_id}
          options={cards
            .filter((card) => !card.archived_at)
            .map((card) => ({ value: card.id, label: card.name }))}
          onValueChange={(id) =>
            onChange({ ...value, credit_card_id: Number(id) || null })
          }
          className="sm:col-span-2"
          placeholder={t('cards.select_card')}
          error={errors.credit_card_id}
        />
      )}
    </div>
  );
}
