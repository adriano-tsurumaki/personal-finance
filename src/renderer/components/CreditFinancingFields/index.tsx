import { useId } from 'react';
import {
  FieldSelect,
  Field,
  FieldLabel,
  FieldMoney,
} from '@components/ui/field';
import { Input } from '@components/ui/input';
import { getLocale, t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { financingAmounts } from '@shared/lib/credit-financing';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';

export function emptyFinancing(principal: number): CreditFinancingInput {
  return {
    principal_cents: principal,
    interest: { mode: 'amount', value: 0 },
    iof: { mode: 'amount', value: 0 },
  };
}

/** Local draft controls; the submitting financial operation owns coordination. */
export default function CreditFinancingFields({
  value,
  onChange,
}: {
  value: CreditFinancingInput;
  onChange: (value: CreditFinancingInput, total: number) => void;
}) {
  const prefix = useId();
  let total = 0;
  let invalid = false;
  try {
    total = financingAmounts(value).total_cents;
  } catch {
    invalid = true;
  }
  function change(next: CreditFinancingInput) {
    let amount = 0;
    try {
      amount = financingAmounts(next).total_cents;
    } catch {
      // Preserve invalid drafts for correction; persistence independently validates.
    }
    onChange(next, amount);
  }
  return (
    <div className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2">
      <FieldMoney
        label={t('financing.principal')}
        money={value.principal_cents / 100}
        decimalSeparator={getLocale() === 'pt-BR' ? ',' : '.'}
        onMoneyChange={(amount) =>
          change({ ...value, principal_cents: Math.round(amount * 100) })
        }
      />
      {(['interest', 'iof'] as const).map((key) => (
        <div key={key} className="grid grid-cols-2 gap-3">
          <FieldSelect
            label={t(`financing.${key}`)}
            value={value[key].mode}
            options={[
              { value: 'amount', label: 'R$' },
              { value: 'percent', label: '%' },
            ]}
            onValueChange={(mode) =>
              change({ ...value, [key]: { mode, value: 0 } })
            }
          />
          {value[key].mode === 'amount' ? (
            <FieldMoney
              label={t(`financing.${key}`)}
              money={value[key].value / 100}
              decimalSeparator={getLocale() === 'pt-BR' ? ',' : '.'}
              onMoneyChange={(amount) =>
                change({
                  ...value,
                  [key]: { mode: 'amount', value: Math.round(amount * 100) },
                })
              }
            />
          ) : (
            <Field>
              <FieldLabel htmlFor={`${prefix}-${key}-rate`}>
                {t('financing.rate')}
              </FieldLabel>
              <Input
                id={`${prefix}-${key}-rate`}
                type="number"
                min={0}
                step="0.01"
                required
                value={
                  Number.isFinite(value[key].value) ? value[key].value : ''
                }
                onChange={(event) =>
                  change({
                    ...value,
                    [key]: {
                      mode: 'percent',
                      value:
                        event.target.value === ''
                          ? NaN
                          : Number(event.target.value),
                    },
                  })
                }
              />
            </Field>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {t('financing.rate_hint')}
      </p>
      <p className="text-sm font-medium" role="status">
        {t('financing.total')}: {invalid ? '—' : formatCurrency(total / 100)}
      </p>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {t('financing.invalid')}
        </p>
      )}
    </div>
  );
}
