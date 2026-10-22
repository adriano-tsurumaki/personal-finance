import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useId, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import {
  FieldSelect,
  Field,
  FieldGroup,
  FieldLabel,
  FieldMoney,
  FieldDatePicker,
  FieldContent,
  FieldTitle,
  FieldDescription,
  FieldSet,
} from '@components/ui/field';
import { toast } from '@components/ui/toast';
import { getLocale, t } from '@lib/i18n';
import { confirmCardCorrection } from '@lib/card-corrections';
import { useProfileStore } from '@store/profile';
import type { InvoiceDto, InvoiceInput } from '@shared/contracts/credit-cards';

export default function InvoiceDialog({
  cardId,
  month,
  invoice,
  onClose,
  onSaved,
  returnFocus,
}: {
  cardId: number;
  month: string;
  invoice: InvoiceDto | null;
  onClose: () => void;
  onSaved: (id: number) => Promise<void>;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const id = useId();
  const [input, setInput] = useState<InvoiceInput>({
    opening_date: invoice?.opening_date ?? '',
    closing_date: invoice?.closing_date ?? '',
    due_date: invoice?.due_date ?? '',
    includes_closing_day: invoice?.includes_closing_day ?? true,
    amount_cents: invoice?.amount_cents ?? 0,
    total_source: invoice?.total_source ?? 'statement',
  });
  const [busy, setBusy] = useState(false);
  const session = useProfileStore((state) => state.sessionVersion);
  const current = () => useProfileStore.getState().sessionVersion === session;

  async function suggest() {
    setBusy(true);
    try {
      const period = await window.api.previewInvoicePeriod(cardId, month);

      if (current()) {
        setInput({ ...input, ...period });
      }
    } catch {
      if (current()) {
        toast.add({
          title: t('common.error_title'),
          description: t('cards.save_error'),
        });
      }
    } finally {
      if (current()) {
        setBusy(false);
      }
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (busy || financialActionsBlocked()) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    setBusy(true);
    try {
      let savedId: number;

      if (invoice) {
        const plan = await window.api.previewInvoiceCorrection(
          invoice.id,
          input,
        );

        if (!current() || !(await confirmCardCorrection(plan)) || !current()) {
          return;
        }

        await window.api.correctInvoice(invoice.id, input, plan.token);
        savedId = invoice.id;
      } else {
        savedId = await window.api.registerInvoice(cardId, input);
      }

      if (current()) {
        await onSaved(savedId);
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
            <DialogTitle>
              {t(
                invoice
                  ? 'cards.correct_invoice_action'
                  : 'cards.historical_invoice',
              )}
            </DialogTitle>
            <DialogDescription>{t('cards.preview_hint')}</DialogDescription>
          </DialogHeader>
          <FieldSet disabled={busy || blocked}>
            <FieldGroup className="py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void suggest()}
              >
                <CalendarDays aria-hidden="true" />
                {t('cards.preview')} · {month}
              </Button>
              {(['opening_date', 'closing_date', 'due_date'] as const).map(
                (key) => (
                  <FieldDatePicker
                    key={key}
                    id={`${id}-${key}`}
                    label={t(
                      key === 'opening_date'
                        ? 'cards.opening'
                        : key === 'closing_date'
                          ? 'cards.closing'
                          : 'cards.due',
                    )}
                    value={input[key] ? parseISO(input[key]) : undefined}
                    disabled={busy || blocked}
                    placeholder={t('transactions.pick_date')}
                    onValueChange={(value) =>
                      setInput({
                        ...input,
                        [key]: value ? format(value, 'yyyy-MM-dd') : '',
                      })
                    }
                  />
                ),
              )}
              <FieldLabel>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`${id}-includes-closing`}
                    disabled={busy || blocked}
                    checked={input.includes_closing_day}
                    onCheckedChange={(checked) =>
                      setInput({ ...input, includes_closing_day: checked })
                    }
                  />
                  <FieldContent>
                    <FieldTitle>{t('cards.includes_closing')}</FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
              <FieldSelect
                label={t('cards.total_source')}
                options={[
                  {
                    value: 'statement',
                    label: t('cards.statement'),
                  },
                  {
                    value: 'calculated',
                    label: t('cards.calculated'),
                  },
                ]}
                required
                value={input.total_source}
                onValueChange={(value) =>
                  setInput({
                    ...input,
                    total_source: value as InvoiceInput['total_source'],
                  })
                }
                placeholder={t('cards.select_card')}
              />
              {input.total_source === 'statement' && (
                <FieldMoney
                  label={t('cards.total')}
                  money={input.amount_cents / 100}
                  onMoneyChange={(value) =>
                    setInput({
                      ...input,
                      amount_cents: Math.round(value * 100),
                    })
                  }
                  currencySymbol="R$"
                  decimalSeparator={getLocale() === 'pt-BR' ? ',' : '.'}
                  showCurrencySymbol
                />
              )}
              <FieldDescription>{t('cards.statement_hint')}</FieldDescription>
            </FieldGroup>
          </FieldSet>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy || blocked}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || blocked}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
