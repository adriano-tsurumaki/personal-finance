import { useId } from 'react';
import {
  Field,
  FieldLabel,
  FieldMoney,
  FieldError,
} from '@components/ui/field';
import { Input } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
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
  errors = {},
}: {
  value: DefaultValues;
  onChange: (next: DefaultValues) => void;
  cards: CreditCardDto[];
  fixedType?: boolean;
  errors?: Partial<Record<keyof DefaultValues, string>>;
}) {
  const prefix = useId();
  const options = useProfileStore((state) => state.options);
  const credit =
    options.payments.find((row) => row.id === value.payment_id)?.catalog_key ===
    'credit';
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
        label={t('transactions.amount')}
        decimalSeparator={getLocale() === 'en-US' ? '.' : ','}
        error={errors.amount_cents}
        money={value.amount_cents / 100}
        onMoneyChange={(amount) =>
          onChange({ ...value, amount_cents: Math.round(amount * 100) })
        }
      />
      <Field>
        <FieldLabel htmlFor={`${prefix}-type`}>
          {t('transactions.type')}
        </FieldLabel>
        <Select
          value={value.type}
          items={[
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
        >
          <SelectTrigger id={`${prefix}-type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={1}>{t('transactions.income')}</SelectItem>
            <SelectItem value={2}>{t('transactions.expense')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-category`}>
          {t('transactions.category')}
        </FieldLabel>
        <Select
          value={value.category_id}
          items={categories.map((row) => ({
            value: row.id,
            label: categoryLabel(row),
          }))}
          onValueChange={(id) =>
            onChange({ ...value, category_id: Number(id) || null })
          }
        >
          <SelectTrigger
            id={`${prefix}-category`}
            aria-invalid={!!errors.category_id}
          >
            <SelectValue placeholder={t('transactions.select_category')} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {categoryLabel(row)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{errors.category_id}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-payment`}>
          {t('transactions.payment')}
        </FieldLabel>
        <Select
          value={value.payment_id || null}
          items={payments.map((row) => ({
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
        >
          <SelectTrigger
            id={`${prefix}-payment`}
            aria-invalid={!!errors.payment_id}
          >
            <SelectValue placeholder={t('transactions.select_payment')} />
          </SelectTrigger>
          <SelectContent>
            {payments.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {t(`payments.${row.catalog_key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{errors.payment_id}</FieldError>
      </Field>
      {credit && (
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${prefix}-card`}>{t('cards.card')}</FieldLabel>
          <Select
            value={value.credit_card_id}
            items={cards
              .filter((card) => !card.archived_at)
              .map((card) => ({ value: card.id, label: card.name }))}
            onValueChange={(id) =>
              onChange({ ...value, credit_card_id: Number(id) || null })
            }
          >
            <SelectTrigger
              id={`${prefix}-card`}
              aria-invalid={!!errors.credit_card_id}
            >
              <SelectValue placeholder={t('cards.select_card')} />
            </SelectTrigger>
            <SelectContent>
              {cards
                .filter((card) => !card.archived_at)
                .map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.credit_card_id}</FieldError>
        </Field>
      )}
    </div>
  );
}
