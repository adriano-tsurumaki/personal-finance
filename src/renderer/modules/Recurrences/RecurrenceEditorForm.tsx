import CreditFinancingFields, {
  emptyFinancing,
} from '@components/CreditFinancingFields';
import { Button } from '@components/ui/button';
import {
  Field,
  FieldSelect,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@components/ui/field';
import { Input } from '@components/ui/input';
import { t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { financialActionsBlocked } from '@store/financial-operations';
import DefaultFields from './DefaultFields';
import { occurrenceDate } from './OccurrenceSummary';
import type { RecurrenceEditorProps } from './RecurrenceEditor';
import type { RecurrenceEditorModel } from './use-recurrence-editor';

export function RecurrenceEditorForm({
  editor,
  cards,
  busy,
  onClose,
  model,
}: Pick<RecurrenceEditorProps, 'editor' | 'cards' | 'busy' | 'onClose'> & {
  model: RecurrenceEditorModel;
}) {
  const {
    values,
    setValues,
    date,
    setDate,
    cadence,
    setCadence,
    financing,
    setFinancing,
    errors,
    credit,
    financed,
    defaultsForm,
    blocked,
    invoiceId,
    setInvoiceId,
    invoiceMonth,
    setInvoiceMonth,
    dueDate,
    boundaryPreview,
    boundaryFailed,
    invoices,
    billingLoading,
    billingFailed,
    saveDisabled,
    submit,
    changeDefaults,
    setSplit,
  } = model;
  return (
    <form className="space-y-4" onSubmit={submit}>
      {defaultsForm && (
        <DefaultFields
          value={values}
          onChange={changeDefaults}
          cards={cards}
          amountReadOnly={editor.action === 'confirm' && financed}
          fixedType={editor.action !== 'create'}
          errors={errors}
        />
      )}
      {editor.action === 'create' && (
        <FieldSelect
          label={t('recurrence.frequency')}
          value={cadence}
          options={(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(
            (value) => ({ value, label: t(`recurrence.${value}`) }),
          )}
          onValueChange={(value) => setCadence(String(value))}
        />
      )}
      <Field>
        <FieldLabel htmlFor="recurrence-date">
          {t(
            editor.action === 'confirm'
              ? 'transactions.date'
              : editor.action === 'pause' || editor.action === 'end'
                ? 'recurrence.last_retained'
                : editor.action === 'edit'
                  ? 'recurrence.effective_date'
                  : 'recurrence.first_date',
          )}
        </FieldLabel>
        <Input
          id="recurrence-date"
          required
          type="date"
          value={date}
          onInput={(event) => setDate(event.currentTarget.value)}
          onChange={(event) => setDate(event.currentTarget.value)}
        />
      </Field>
      {(editor.action === 'pause' || editor.action === 'end') && (
        <FieldDescription className="text-xs">
          {t('recurrence.retained_preview', { date: occurrenceDate(date) })}
          {boundaryPreview ? (
            <>
              <span className="mt-2 block">
                {t('recurrence.first_removed', {
                  date: occurrenceDate(boundaryPreview.first_removed_date),
                  count: boundaryPreview.confirmed_transactions.length,
                })}
              </span>
              {boundaryPreview.confirmed_transactions.length > 0 && (
                <span className="mt-2 block">
                  {boundaryPreview.confirmed_transactions.map((entry) => (
                    <span className="block" key={entry.id}>
                      #{entry.id} · {entry.name} ·{' '}
                      {occurrenceDate(entry.scheduled_date)}
                      {entry.reference_date &&
                      entry.reference_date !== entry.scheduled_date
                        ? ' → ' + occurrenceDate(entry.reference_date)
                        : ''}{' '}
                      · {formatCurrency(entry.amount_cents / 100)}
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <span role="status" className="mt-2 block">
              {t(
                boundaryFailed
                  ? 'recurrence.boundary_invalid'
                  : 'common.loading',
              )}
            </span>
          )}
        </FieldDescription>
      )}
      {editor.action === 'confirm' && financed && (
        <CreditFinancingFields
          value={financing ?? emptyFinancing(values.amount_cents)}
          onChange={(next, total) => {
            setFinancing(next);
            setValues({ ...values, amount_cents: total });
          }}
        />
      )}
      {editor.action === 'confirm' && credit && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || blocked}
          onClick={() => {
            if (!financialActionsBlocked()) {
              setSplit(true);
            }
          }}
        >
          {t('financing.installments')}
        </Button>
      )}
      {editor.action === 'confirm' && credit && (
        <Field>
          <FieldLabel htmlFor="recurrence-invoice-month">
            {t('financing.first_invoice_month')}
          </FieldLabel>
          <Input
            id="recurrence-invoice-month"
            type="month"
            value={invoiceMonth ?? ''}
            onChange={(event) => {
              setInvoiceMonth(event.target.value || null);
              setInvoiceId(null);
            }}
          />
          <FieldDescription className="text-xs">
            {t('financing.invoice_month_hint')}
          </FieldDescription>
        </Field>
      )}
      {editor.action === 'confirm' && credit && (
        <FieldSelect
          label={t('cards.invoice')}
          value={invoiceId}
          options={[
            { value: null, label: t('cards.automatic') },
            ...invoices.map((row) => ({
              value: row.id,
              label: `#${row.id} · ${occurrenceDate(row.due_date)}`,
            })),
          ]}
          onValueChange={(id) => {
            setInvoiceMonth(null);
            setInvoiceId(Number(id) || null);
          }}
        >
          {billingLoading && (
            <FieldDescription role="status" className="text-xs">
              {t('common.loading')}
            </FieldDescription>
          )}
          {billingFailed && (
            <FieldError className="text-expense">
              {t('recurrence.billing_unavailable')}
            </FieldError>
          )}
        </FieldSelect>
      )}
      {editor.action === 'confirm' && (
        <FieldDescription className="text-xs">
          {t('recurrence.cash_flow', {
            date: credit
              ? dueDate
                ? occurrenceDate(dueDate)
                : '—'
              : occurrenceDate(date),
          })}
        </FieldDescription>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saveDisabled}>
          {t(busy ? 'transactions.saving' : 'recurrence.save')}
        </Button>
      </div>
    </form>
  );
}
