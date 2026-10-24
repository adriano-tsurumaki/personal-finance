import { emptyFinancing } from '@components/CreditFinancingFields';
import { confirmCardCorrection } from '@lib/card-corrections';
import { useProfileStore } from '@store/profile';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';
import type {
  RecurrenceDefaults,
  RecurrenceResult,
} from '@shared/contracts/recurrence';
import { invoiceSelection } from './invoice-selection';
import type { Editor } from './RecurrenceEditor';

interface RecurrenceEditorOperation {
  editor: Editor;
  values: RecurrenceDefaults;
  date: string;
  cadence: string;
  credit: boolean;
  financed: boolean;
  financing: CreditFinancingInput | null;
  invoiceMonth: string | null;
  invoiceId: number | null;
  profile: { id: number } | null;
  session: number;
}

export async function saveRecurrenceEditor({
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
}: RecurrenceEditorOperation): Promise<RecurrenceResult<unknown>> {
  const occurrence = 'occurrence' in editor ? editor.occurrence : null;

  if (editor.action === 'create') {
    return window.api.recurrence.create({
      ...values,
      start_date: date,
      frequency: cadence === 'weekly' ? 2 : cadence === 'yearly' ? 4 : 3,
      interval: cadence === 'quarterly' ? 3 : 1,
    });
  }

  if (editor.action === 'edit') {
    return window.api.recurrence.update({
      ...values,
      recurrence_id: editor.rule.id,
      scheduled_date: date,
      expected_version_id:
        editor.rule.versions.find(
          (entry) =>
            entry.start_date <= date &&
            (!entry.end_date || date < entry.end_date),
        )?.id ?? editor.rule.versions.at(-1)!.id,
    });
  }

  if (editor.action === 'pause' || editor.action === 'end') {
    return window.api.recurrence.boundary({
      recurrence_id: editor.rule.id,
      last_retained_date: date,
      action: editor.action,
    });
  }

  if (editor.action === 'resume') {
    return window.api.recurrence.resume({
      recurrence_id: editor.rule.id,
      first_date: date,
    });
  }

  if (!occurrence || !profile) {
    throw new Error('No active occurrence.');
  }

  const input = {
    ...values,
    recurrence_id: occurrence.recurrence_id,
    scheduled_date: occurrence.scheduled_date,
    expected_version_id: occurrence.version_id,
    reference_date: date,
    ...invoiceSelection(credit, invoiceMonth, invoiceId),
    financing: financed
      ? (financing ?? emptyFinancing(values.amount_cents))
      : null,
  };
  let correction_token: string | undefined;

  if (credit) {
    const plan = await window.api.previewTransactionCreation({
      ...values,
      financing: input.financing,
      invoice_month: invoiceMonth,
      card_id: values.credit_card_id,
      user_id: profile.id,
      reference_date: date,
      payment_date: null,
      credit_card_invoice_id: invoiceId,
    });

    if (
      session !== useProfileStore.getState().sessionVersion ||
      !plan ||
      !(await confirmCardCorrection(plan)) ||
      session !== useProfileStore.getState().sessionVersion
    ) {
      return {
        ok: false,
        error: { code: 'conflict', message: 'Cancelled' },
      };
    }

    correction_token = plan.token;
  }

  return window.api.recurrence.confirm({
    ...input,
    correction_token,
  });
}
