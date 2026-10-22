import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { FieldSelect, FieldGroup } from '@components/ui/field';
import { toast } from '@components/ui/toast';
import { t } from '@lib/i18n';
import { cardDate, confirmCardCorrection } from '@lib/card-corrections';
import { useProfileStore } from '@store/profile';
import type {
  CreditCardDto,
  InvoiceDto,
  InvoiceEntryDto,
} from '@shared/contracts/credit-cards';

export default function AssociationDialog({
  entry,
  cards,
  initialCard,
  onClose,
  onSaved,
  returnFocus,
}: {
  entry: InvoiceEntryDto;
  cards: CreditCardDto[];
  initialCard: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const [cardId, setCardId] = useState<number | null>(initialCard);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = useProfileStore((state) => state.sessionVersion);
  const current = () => useProfileStore.getState().sessionVersion === session;

  useEffect(() => {
    let active = true;
    setInvoices([]);
    setInvoiceId(null);

    if (cardId !== null) {
      setLoading(true);
      void window.api
        .getCardInvoices(cardId)
        .then((rows) => {
          if (active && current()) {
            setInvoices(rows);
          }
        })
        .catch(() => {
          if (active && current()) {
            toast.add({
              title: t('common.error_title'),
              description: t('cards.save_error'),
            });
          }
        })
        .finally(() => {
          if (active && current()) {
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [cardId, session]);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (
      busy ||
      financialActionsBlocked() ||
      cardId === null ||
      invoiceId === null
    ) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    setBusy(true);
    try {
      const input = { card_id: cardId, invoice_id: invoiceId };
      const plan = await window.api.previewInvoiceAssociation(entry.id, input);

      if (!current() || !(await confirmCardCorrection(plan)) || !current()) {
        return;
      }

      await window.api.associateInvoice(entry.id, input, plan.token);

      if (current()) {
        await onSaved();
        onClose();
      }
    } catch {
      if (current()) {
        toast.add({
          title: t('common.error_title'),
          description: t('cards.save_error'),
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
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{t('cards.associate')}</DialogTitle>
            <DialogDescription>
              {entry.name} · {t('cards.override_hint')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <FieldSelect<number>
              label={t('cards.card')}
              disabled={busy || blocked}
              options={cards.map((card) => ({
                value: card.id,
                label: card.name,
                content: `${card.name}${card.archived_at ? ` (${t('cards.archived')})` : ''}`,
              }))}
              value={cardId}
              onValueChange={(value) => setCardId(value)}
              placeholder={t('cards.select_card')}
            />
            <FieldSelect<number>
              label={t('cards.invoice')}
              required
              disabled={
                busy ||
                blocked ||
                cardId === null ||
                loading ||
                !invoices.length
              }
              options={invoices.map((invoice) => ({
                value: invoice.id,
                label: `${cardDate(invoice.closing_date)} · #${invoice.id}`,
              }))}
              value={invoiceId}
              onValueChange={(value) => setInvoiceId(value)}
              placeholder={t('cards.select_invoice')}
            />
            {!loading && cardId !== null && !invoices.length && (
              <p role="status">{t('cards.no_invoices')}</p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy || blocked}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={busy || blocked || loading || invoiceId === null}
            >
              {t('cards.apply_changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
