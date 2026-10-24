import { useEffect, useState, type FormEvent } from 'react';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';
import type { RecurrenceDefaults } from '@shared/contracts/recurrence';
import { isCreditPayment, isFinancedPayment } from '@shared/lib/payment-method';
import { t } from '@lib/i18n';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type { DefaultValues } from './DefaultFields';
import { invoiceSelection } from './invoice-selection';
import { localToday } from './presentation';
import { validateDefaults } from './validation';
import { saveRecurrenceEditor } from './recurrence-editor-operation';
import { useRecurrenceEditorPreviews } from './use-recurrence-editor-previews';
import type { RecurrenceEditorProps } from './RecurrenceEditor';

const blank: RecurrenceDefaults = {
  name: '',
  type: 2,
  amount_cents: 0,
  category_id: null,
  payment_id: 0,
  credit_card_id: null,
};

export function useRecurrenceEditor({
  editor,
  cards,
  busy,
  onSave,
}: RecurrenceEditorProps) {
  const version = 'rule' in editor ? editor.rule.versions.at(-1) : null;
  const occurrence = 'occurrence' in editor ? editor.occurrence : null;
  const [split, setSplit] = useState(false);
  const [financing, setFinancing] = useState<CreditFinancingInput | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof DefaultValues, string>>
  >({});
  const [values, setValues] = useState<RecurrenceDefaults>(
    occurrence ??
      (version
        ? {
            ...version,
            type: version.type ?? 2,
            payment_id: version.payment_id ?? 0,
          }
        : blank),
  );
  const [date, setDate] = useState(
    occurrence?.scheduled_date ??
      ('rule' in editor
        ? (editor.rule.last_retained_date ?? version?.start_date)
        : null) ??
      localToday(),
  );
  const [cadence, setCadence] = useState('monthly');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<string | null>(null);
  const session = useProfileStore((state) => state.sessionVersion);
  const profile = useProfileStore((state) => state.activeProfile);
  const options = useProfileStore((state) => state.options);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const credit = isCreditPayment(
    options.payments.find((row) => row.id === values.payment_id)?.catalog_key,
  );
  const financed = isFinancedPayment(
    options.payments.find((row) => row.id === values.payment_id)?.catalog_key,
  );
  const defaultsForm = ['create', 'edit', 'confirm'].includes(editor.action);

  const previews = useRecurrenceEditorPreviews({
    editor,
    credit,
    cardId: values.credit_card_id,
    date,
    invoiceMonth,
    session,
  });
  const {
    invoices,
    suggestion,
    boundaryPreview,
    billingFailed,
    billingLoading,
  } = previews;
  useEffect(() => {
    setInvoiceId(null);
  }, [values.credit_card_id, date]);
  const selectedInvoice = invoices.find((row) => row.id === invoiceId);
  const dueDate = invoiceId
    ? (selectedInvoice?.paid_at ?? selectedInvoice?.due_date)
    : suggestion?.due_date;

  const saveDisabled =
    busy ||
    blocked ||
    ((editor.action === 'pause' || editor.action === 'end') &&
      !boundaryPreview) ||
    (editor.action === 'confirm' &&
      credit &&
      (billingFailed || billingLoading));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || financialActionsBlocked() || saveDisabled) {
      return;
    }

    const invalid = defaultsForm
      ? validateDefaults(values, options, cards)
      : {};
    setErrors(
      Object.fromEntries(
        Object.entries(invalid).map(([field, key]) => [field, t(key)]),
      ),
    );

    if (Object.keys(invalid).length > 0) {
      return;
    }

    void onSave(() =>
      saveRecurrenceEditor({
        editor,
        values,
        date,
        cadence,
        credit,
        financed,
        financing,
        invoiceMonth,
        invoiceId,
        profile,
        session,
      }),
    );
  }

  function changeDefaults(next: DefaultValues) {
    if (next.payment_id !== values.payment_id) {
      setFinancing(null);
      const selection = invoiceSelection(
        isCreditPayment(
          options.payments.find((row) => row.id === next.payment_id)
            ?.catalog_key,
        ),
        invoiceMonth,
        invoiceId,
      );
      setInvoiceMonth(selection.invoice_month);
      setInvoiceId(selection.credit_card_invoice_id);
      next.amount_cents = financing?.principal_cents ?? next.amount_cents;
    } else if (financing && next.amount_cents !== values.amount_cents) {
      setFinancing(null);
    }

    setValues(next);
  }

  return {
    split,
    setSplit,
    occurrence,
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
    ...previews,
    saveDisabled,
    submit,
    changeDefaults,
  };
}

export type RecurrenceEditorModel = ReturnType<typeof useRecurrenceEditor>;
