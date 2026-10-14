import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useEffect, useId, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldContent,
  FieldTitle,
} from '@components/ui/field';
import { toast } from '@components/ui/toast';
import { t } from '@lib/i18n';
import { cardDate } from '@lib/card-corrections';
import { useProfileStore } from '@store/profile';
import { currentMonthKey } from '@shared/lib/calc';
import type {
  CreditCardDto,
  CreditCardInput,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import { Checkbox } from '@components/ui/checkbox';
import { CalendarDays, CalendarClock, LockKeyhole } from 'lucide-react';

export default function CardDialog({
  card,
  onClose,
  onSaved,
  returnFocus,
}: {
  card: CreditCardDto | 'new';
  onClose: () => void;
  onSaved: (id: number) => Promise<void>;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const id = useId();
  const [input, setInput] = useState<CreditCardInput>({
    name: card === 'new' ? '' : card.name,
    closing_day: card === 'new' ? 20 : (card.closing_day ?? 20),
    includes_closing_day:
      card === 'new' ? true : (card.includes_closing_day ?? true),
    due_days_after_closing:
      card === 'new' ? 7 : (card.due_days_after_closing ?? 7),
  });
  const [period, setPeriod] = useState<InvoicePeriodDto | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useProfileStore((state) => state.sessionVersion);

  useEffect(() => {
    let active = true;

    if (card === 'new') {
      void window.api
        .previewCreditCard(input, currentMonthKey())
        .then((value) => {
          if (active) {
            setPeriod(value);
          }
        })
        .catch(() => {
          if (active) {
            setPeriod(null);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [input, card]);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (busy || financialActionsBlocked()) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    setBusy(true);
    try {
      const savedId =
        card === 'new'
          ? await window.api.createCreditCard(input)
          : (await window.api.renameCreditCard(card.id, input.name), card.id);

      if (useProfileStore.getState().sessionVersion === session) {
        await onSaved(savedId);
        onClose();
      }
    } catch {
      if (useProfileStore.getState().sessionVersion === session) {
        toast.add({
          title: t('common.error_title'),
          description: t('cards.save_error'),
        });
      }
    } finally {
      release();

      if (useProfileStore.getState().sessionVersion === session) {
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
      <DialogContent
        showCloseButton={!busy}
        finalFocus={returnFocus}
        className={card === 'new' ? 'sm:max-w-3xl' : undefined}
      >
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>
              {t(card === 'new' ? 'cards.new_card' : 'cards.rename')}
            </DialogTitle>
            <DialogDescription>
              {t(
                card === 'new' ? 'cards.preview_hint' : 'cards.rules_read_only',
              )}
            </DialogDescription>
          </DialogHeader>
          <div
            className={
              card === 'new'
                ? 'grid items-start gap-5 py-4 sm:grid-cols-2'
                : 'py-4'
            }
          >
            <FieldSet disabled={busy || blocked}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${id}-name`}>
                    {t('cards.name')}
                  </FieldLabel>
                  <Input
                    id={`${id}-name`}
                    autoFocus
                    required
                    maxLength={100}
                    value={input.name}
                    onChange={(event) =>
                      setInput({ ...input, name: event.target.value })
                    }
                  />
                </Field>
                {card === 'new' && (
                  <>
                    <div className="grid grid-cols-2 items-end gap-4">
                      <Field>
                        <FieldLabel htmlFor={`${id}-closing`}>
                          {t('cards.closing_day')}
                        </FieldLabel>
                        <Input
                          id={`${id}-closing`}
                          type="number"
                          min={1}
                          max={31}
                          step={1}
                          required
                          value={input.closing_day}
                          onChange={(event) =>
                            setInput({
                              ...input,
                              closing_day: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${id}-due`}>
                          {t('cards.due_days')}
                        </FieldLabel>
                        <Input
                          id={`${id}-due`}
                          type="number"
                          min={1}
                          step={1}
                          required
                          value={input.due_days_after_closing}
                          onChange={(event) =>
                            setInput({
                              ...input,
                              due_days_after_closing: Number(
                                event.target.value,
                              ),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <FieldLabel>
                      <Field orientation="horizontal">
                        <Checkbox
                          id={`${id}-includes-closing`}
                          checked={input.includes_closing_day}
                          onCheckedChange={(checked) =>
                            setInput({
                              ...input,
                              includes_closing_day: checked,
                            })
                          }
                        />
                        <FieldContent>
                          <FieldTitle>{t('cards.includes_closing')}</FieldTitle>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  </>
                )}
              </FieldGroup>
            </FieldSet>
            {card === 'new' && period && (
              <section
                role="status"
                aria-labelledby={`${id}-preview`}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <h3
                  id={`${id}-preview`}
                  className="border-b border-border bg-secondary/50 px-3 py-2 text-xs font-medium"
                >
                  {t('cards.billing_preview')}
                </h3>
                <dl className="px-3 py-4">
                  {[
                    {
                      label: t('cards.opening'),
                      date: period.opening_date,
                      Icon: CalendarDays,
                    },
                    {
                      label: t('cards.closing'),
                      date: period.closing_date,
                      Icon: LockKeyhole,
                      hint: t(
                        input.includes_closing_day
                          ? 'cards.closing_included'
                          : 'cards.closing_excluded',
                      ),
                    },
                    {
                      label: t('cards.due'),
                      date: period.due_date,
                      Icon: CalendarClock,
                      hint: t(
                        input.due_days_after_closing === 1
                          ? 'cards.due_offset_one'
                          : 'cards.due_offset_other',
                        { days: input.due_days_after_closing },
                      ),
                    },
                  ].map(({ label, date, Icon, hint }, index) => (
                    <div
                      key={label}
                      className="relative flex gap-3 pb-4 last:pb-0"
                    >
                      {index < 2 && (
                        <span
                          aria-hidden="true"
                          className="absolute top-8 bottom-0 left-4 border-l border-border"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary"
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="font-mono text-xs font-medium tabular-nums">
                            <time dateTime={date}>{cardDate(date)}</time>
                          </dd>
                        </div>
                        {hint && (
                          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {hint}
                          </dd>
                        )}
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy || blocked}
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
