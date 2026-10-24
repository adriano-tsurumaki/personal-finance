import { useEffect, useState } from 'react';
import { useProfileStore } from '@store/profile';
import type { RecurrenceBoundaryPreviewDto } from '@shared/contracts/recurrence';
import type {
  InvoiceDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import type { Editor } from './RecurrenceEditor';

export function useRecurrenceEditorPreviews({
  editor,
  credit,
  cardId,
  date,
  invoiceMonth,
  session,
}: {
  editor: Editor;
  credit: boolean;
  cardId: number | null;
  date: string;
  invoiceMonth: string | null;
  session: number;
}) {
  const [boundaryPreview, setBoundaryPreview] =
    useState<RecurrenceBoundaryPreviewDto | null>(null);
  const [boundaryFailed, setBoundaryFailed] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suggestion, setSuggestion] = useState<InvoicePeriodDto | null>(null);
  const [billingFailed, setBillingFailed] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setInvoices([]);
    setSuggestion(null);
    setBillingFailed(false);
    setBillingLoading(false);

    if (editor.action === 'confirm' && credit && cardId) {
      setBillingLoading(true);
      void Promise.all([
        window.api.getCardInvoices(cardId),
        invoiceMonth
          ? window.api.previewInvoicePeriod(cardId, invoiceMonth)
          : window.api.suggestInvoicePeriod(cardId, date),
      ])
        .then(([rows, period]) => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setInvoices(rows);
            setSuggestion(period);
          }
        })
        .catch(() => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setBillingFailed(true);
          }
        })
        .finally(() => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setBillingLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [editor.action, credit, cardId, date, session, invoiceMonth]);
  useEffect(() => {
    let active = true;
    setBoundaryPreview(null);
    setBoundaryFailed(false);

    if ((editor.action === 'pause' || editor.action === 'end') && date) {
      void window.api.recurrence
        .previewBoundary({
          recurrence_id: editor.rule.id,
          last_retained_date: date,
        })
        .then((preview) => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setBoundaryPreview(preview);
          }
        })
        .catch(() => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setBoundaryFailed(true);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [editor, date, session]);

  return {
    boundaryPreview,
    boundaryFailed,
    invoices,
    suggestion,
    billingFailed,
    billingLoading,
  };
}
