import { emptyFinancing } from '@components/CreditFinancingFields';
import PlanDialog from '@modules/Installments/PlanDialog';
import { FieldDescription } from '@components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@components/ui/dialog';
import { t } from '@lib/i18n';
import { useAppStore } from '@store/transaction';
import type { CreditCardDto } from '@shared/contracts/credit-cards';
import type {
  RecurrenceRuleDto,
  RecurrenceOccurrenceDto,
  RecurrenceResult,
} from '@shared/contracts/recurrence';
import { installmentInvoiceSelection } from './invoice-selection';
import { RecurrenceEditorForm } from './RecurrenceEditorForm';
import { useRecurrenceEditor } from './use-recurrence-editor';

export type Editor =
  | { action: 'create' }
  | { action: 'edit' | 'pause' | 'end' | 'resume'; rule: RecurrenceRuleDto }
  | { action: 'confirm'; occurrence: RecurrenceOccurrenceDto };

export interface RecurrenceEditorProps {
  editor: Editor;
  cards: CreditCardDto[];
  busy: boolean;
  returnFocus: HTMLElement | null;
  onClose: () => void;
  onInstallmentSaved?: () => Promise<void>;
  onSave: (
    operation: () => Promise<RecurrenceResult<unknown>>,
  ) => Promise<void>;
}

export function RecurrenceEditor(props: RecurrenceEditorProps) {
  const { editor, cards, busy, onClose, onInstallmentSaved, returnFocus } =
    props;
  const model = useRecurrenceEditor(props);
  const {
    split,
    occurrence,
    date,
    values,
    financing,
    financed,
    invoiceMonth,
    invoiceId,
    defaultsForm,
  } = model;
  const form = (
    <RecurrenceEditorForm
      editor={editor}
      cards={cards}
      busy={busy}
      onClose={onClose}
      model={model}
    />
  );

  if (split && occurrence && editor.action === 'confirm') {
    return (
      <PlanDialog
        month={date.slice(0, 7)}
        occurrence={occurrence}
        initial={{
          name: values.name,
          total_amount_cents: values.amount_cents,
          payment_id: values.payment_id,
          category_id: values.category_id,
          card_id: values.credit_card_id,
          purchase_at: date,
          start_date: date,
          ...installmentInvoiceSelection(invoiceMonth, invoiceId),
          financing: financed
            ? (financing ?? emptyFinancing(values.amount_cents))
            : null,
        }}
        onClose={onClose}
        onSaved={
          onInstallmentSaved ?? (() => useAppStore.getState().refreshMonth())
        }
      />
    );
  }

  if (editor.action === 'create') {
    return (
      <div className="my-5 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">{t('recurrence.create')}</h3>
        <FieldDescription className="mb-4 text-xs">
          {t('recurrence.defaults_hint')}
        </FieldDescription>
        {form}
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (busy) {
          details.cancel();
        } else if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        finalFocus={() => (returnFocus?.isConnected ? returnFocus : false)}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t(`recurrence.${editor.action}`)}</DialogTitle>
          <DialogDescription>
            {t(
              editor.action === 'confirm'
                ? 'recurrence.confirm_hint'
                : defaultsForm
                  ? 'recurrence.defaults_hint'
                  : 'recurrence.boundary_hint',
            )}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
