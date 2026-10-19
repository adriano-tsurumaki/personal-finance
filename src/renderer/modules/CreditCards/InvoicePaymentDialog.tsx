import { useId, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { FieldDatePicker } from '@components/ui/field';
import { toast } from '@components/ui/toast';
import { t } from '@lib/i18n';
import { cardDate } from '@lib/card-corrections';
import { formatCurrency } from '@lib/format/currency';
import { confirmation } from '@store/confirmation';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type { InvoiceDto } from '@shared/contracts/credit-cards';

export default function InvoicePaymentDialog({
  invoice,
  onClose,
  onSaved,
  returnFocus,
}: {
  invoice: InvoiceDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const id = useId();
  const [date, setDate] = useState(
    invoice.paid_at ?? format(new Date(), 'yyyy-MM-dd'),
  );
  const [busy, setBusy] = useState(false);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const session = useProfileStore((state) => state.sessionVersion);
  const current = () => useProfileStore.getState().sessionVersion === session;

  async function save(paidAt: string | null) {
    if (busy || financialActionsBlocked() || paidAt === '') {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    setBusy(true);
    try {
      if (
        paidAt === null &&
        (!(await confirmation.confirm({
          title: t('cards.undo_payment'),
          description: t('cards.undo_payment_hint'),
        })) ||
          !current())
      ) {
        return;
      }

      await window.api.setInvoicePayment(invoice.id, {
        paid_at: paidAt,
        expected_paid_at: invoice.paid_at,
        expected_amount_cents: invoice.amount_cents,
      });

      if (!current()) {
        return;
      }

      await onSaved();

      if (current()) {
        onClose();
      }
    } catch {
      if (current()) {
        toast.add({
          title: t('common.error_title'),
          description: t('cards.payment_error'),
        });
      }
    } finally {
      release();

      if (current()) {
        setBusy(false);
      }
    }
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
      <DialogContent showCloseButton={!busy} finalFocus={returnFocus}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(date);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                invoice.paid_at
                  ? 'cards.manage_payment'
                  : 'cards.confirm_payment',
              )}
            </DialogTitle>
            <DialogDescription>
              {t('cards.payment_hint', {
                amount: formatCurrency(invoice.amount_cents / 100),
                closing: cardDate(invoice.closing_date),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <FieldDatePicker
              id={`${id}-date`}
              label={t('cards.payment_date')}
              value={date ? parseISO(date) : undefined}
              disabled={busy || blocked}
              placeholder={t('transactions.pick_date')}
              onValueChange={(value) =>
                setDate(value ? format(value, 'yyyy-MM-dd') : '')
              }
            />
          </div>
          <DialogFooter>
            {invoice.paid_at && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || blocked}
                onClick={() => void save(null)}
              >
                {t('cards.undo_payment')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || blocked || !date}>
              {t(invoice.paid_at ? 'common.save' : 'cards.confirm_payment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
