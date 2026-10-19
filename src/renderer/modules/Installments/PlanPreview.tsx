import type {
  InstallmentPlanDto,
  InstallmentPreviewDto,
} from '@shared/contracts/installment';
import { getLocale, t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { FieldMoney } from '@components/ui/field';
import { Checkbox } from '@components/ui/checkbox';
import { planDate } from './presentation';

interface AmountEditor {
  locked: boolean[];
  disabled: boolean;
  onAmountChange: (index: number, cents: number) => void;
  onLockChange: (index: number, locked: boolean) => void;
}

export function PlanSchedule({
  plan,
  amountEditor,
}: {
  plan: InstallmentPlanDto;
  amountEditor?: AmountEditor;
}) {
  return (
    <ol
      className="divide-y divide-border"
      aria-label={t('installments.schedule')}
    >
      {plan.entries.map((row, index) => (
        <li
          key={row.id}
          className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
        >
          <div>
            <span className="mr-2 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs">
              {row.installment_number}/{plan.total_installments}
            </span>
            <time dateTime={row.reference_date}>
              {planDate(row.reference_date)}
            </time>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.invoice
                ? `${t('cards.invoice')} #${row.invoice.id} · ${t('installments.due_date')}: ${planDate(row.invoice.due_date)}`
                : t('installments.direct')}
              {' · '}
              {row.invoice?.paid_at || row.payment_date
                ? t('cards.paid')
                : t('installments.payment_not_recorded')}
            </p>
            {row.invoice && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('installments.period')}:{' '}
                {row.invoice.opening_date
                  ? planDate(row.invoice.opening_date)
                  : '—'}{' '}
                – {planDate(row.invoice.closing_date)}
                {row.invoice.opening_date &&
                  (row.reference_date < row.invoice.opening_date ||
                    row.reference_date > row.invoice.closing_date ||
                    (!row.invoice.includes_closing_day &&
                      row.reference_date === row.invoice.closing_date)) &&
                  ` · ${t('installments.manual_period')}`}
              </p>
            )}
          </div>
          {amountEditor ? (
            <div className="w-full space-y-2 sm:w-44">
              <FieldMoney
                label={t('installments.position', {
                  number: row.installment_number,
                  count: plan.total_installments,
                })}
                money={row.amount_cents / 100}
                decimalSeparator={getLocale() === 'en-US' ? '.' : ','}
                disabled={amountEditor.disabled}
                onMoneyChange={(amount) =>
                  amountEditor.onAmountChange(index, Math.round(amount * 100))
                }
              />
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={amountEditor.locked[index] ?? false}
                  disabled={amountEditor.disabled}
                  onCheckedChange={(checked) =>
                    amountEditor.onLockChange(index, !!checked)
                  }
                />
                {t('installments.lock_amount')}
              </label>
            </div>
          ) : (
            <span className="font-mono font-medium tabular-nums">
              {formatCurrency(row.amount_cents / 100)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function PlanPreview({
  preview,
  amountEditor,
}: {
  preview: InstallmentPreviewDto;
  amountEditor?: AmountEditor;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('installments.preview_hint')}
      </p>
      {amountEditor && (
        <p className="text-xs text-muted-foreground">
          {t('installments.allocation_hint')}
        </p>
      )}
      <PlanSchedule plan={preview.plan} amountEditor={amountEditor} />
      {preview.correction.affected_payment_months.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('cards.affected_months', {
            months: preview.correction.affected_payment_months.join(', '),
          })}
        </p>
      )}
    </div>
  );
}
