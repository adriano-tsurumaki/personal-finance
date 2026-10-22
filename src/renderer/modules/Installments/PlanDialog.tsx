import { allocateFinancing } from '@shared/lib/credit-financing';
import CreditFinancingFields, {
  emptyFinancing,
} from '@components/CreditFinancingFields';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';
import { isCreditPayment, isFinancedPayment } from '@shared/lib/payment-method';
import { useEffect, useId, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Checkbox } from '@components/ui/checkbox';
import { toast } from '@components/ui/toast';
import {
  Field,
  FieldDatePicker,
  FieldLabel,
  FieldMoney,
} from '@components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { categoryLabel, getLocale, t } from '@lib/i18n';
import { redistributeInstallmentAmounts } from './allocation';
import {
  loadFirstInvoiceChoices,
  type FirstInvoiceChoice,
} from './invoice-choices';
import type {
  InstallmentInput,
  InstallmentPlanDto,
  InstallmentPreviewDto,
} from '@shared/contracts/installment';
import type { CreditCardDto, InvoiceDto } from '@shared/contracts/credit-cards';
import PlanPreview from './PlanPreview';
import { installmentError, planDate } from './presentation';

export function Choice({
  label,
  placeholder = label,
  value,
  items,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: number | null;
  items: { value: number; label: string }[];
  onChange: (id: number | null) => void;
}) {
  const id = useId();
  const selected = value ?? (items.some((item) => item.value === 0) ? 0 : null);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={items.some((item) => item.value === selected) ? selected : null}
        items={items}
        onValueChange={(next) => onChange(Number(next) || null)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function FirstInvoiceField({
  choices,
  selectedMonth,
  onChange,
}: {
  choices: FirstInvoiceChoice[];
  selectedMonth: string | null;
  onChange: (month: string) => void;
}) {
  const selected = selectedMonth
    ? choices.findIndex((choice) => choice.month === selectedMonth) + 1
    : choices.length
      ? 1
      : null;
  const retainedMonth = selectedMonth && selected === 0 ? selectedMonth : null;
  const labels = [
    'installments.current_invoice',
    'installments.next_invoice',
    'installments.two_invoices_later',
  ] as const;
  return (
    <div className="space-y-2">
      {retainedMonth && (
        <p role="status" className="text-sm">
          {t('installments.retained_first_invoice', {
            month: new Intl.DateTimeFormat(getLocale(), {
              month: 'long',
              year: 'numeric',
            }).format(parseISO(`${retainedMonth}-01`)),
          })}
        </p>
      )}
      <Choice
        label={t('installments.first_invoice')}
        placeholder={t(
          retainedMonth
            ? 'installments.change_first_invoice'
            : 'installments.select_first_invoice',
        )}
        value={selected}
        items={choices.map((choice, index) => ({
          value: index + 1,
          label: t(labels[index], {
            date: new Intl.DateTimeFormat(getLocale(), {
              day: 'numeric',
              month: 'long',
            }).format(parseISO(choice.dueDate)),
          }),
        }))}
        onChange={(id) => {
          const choice = choices[(id ?? 0) - 1];

          if (choice) {
            onChange(choice.month);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {t(
          choices.length
            ? 'installments.first_invoice_hint'
            : 'installments.invoice_mapping_hint',
        )}
      </p>
    </div>
  );
}

export default function PlanDialog({
  month,
  plan,
  occurrence,
  initial,
  onClose,
  onSaved,
}: {
  month: string;
  plan?: InstallmentPlanDto;
  occurrence?: RecurrenceOccurrenceDto;
  initial?: Partial<InstallmentInput>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const session = useProfileStore((state) => state.sessionVersion);
  const options = useProfileStore((state) => state.options);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const [input, setInput] = useState<InstallmentInput>(() => ({
    request_id: crypto.randomUUID(),
    name: plan?.name ?? '',
    note: plan?.note ?? null,
    total_amount_cents: 0,
    total_installments: 2,
    purchase_at: `${month}-01`,
    start_date: `${month}-01`,
    payment_id: 0,
    category_id: null,
    card_id: null,
    historical_card: false,
    invoice_ids: [],
    ...initial,
  }));
  const [cards, setCards] = useState<CreditCardDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [invoiceChoices, setInvoiceChoices] = useState<FirstInvoiceChoice[]>(
    [],
  );
  const [preview, setPreview] = useState<InstallmentPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [allocationError, setAllocationError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [invoiceChoicesFailed, setInvoiceChoicesFailed] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const alive = useRef(false);
  const running = useRef(false);
  const current = () =>
    alive.current && session === useProfileStore.getState().sessionVersion;
  const credit = isCreditPayment(
    options.payments.find((row) => row.id === input.payment_id)?.catalog_key,
  );
  const financed = isFinancedPayment(
    options.payments.find((row) => row.id === input.payment_id)?.catalog_key,
  );
  const prefix = useId();
  function change(next: Partial<InstallmentInput>) {
    if (running.current) {
      return;
    }

    const resetAmounts =
      next.financing !== undefined ||
      next.total_amount_cents !== undefined ||
      next.total_installments !== undefined ||
      allocationError;
    setInput((previous) => ({
      ...previous,
      ...next,
      ...(resetAmounts ? { installment_amounts_cents: [] } : {}),
    }));

    if (resetAmounts) {
      setLocked([]);
    }

    setPreview(null);
    setPreviewDirty(false);
    setAllocationError(false);
    setError(null);
  }
  function changeAmount(index: number, amount: number) {
    if (running.current || !preview) {
      return;
    }

    setError(null);
    const currentAmounts = preview.plan.entries.map((row) => row.amount_cents);
    let next = [...currentAmounts];
    try {
      next = redistributeInstallmentAmounts(
        input.total_amount_cents,
        currentAmounts,
        currentAmounts.map((_, position) => locked[position] ?? false),
        index,
        amount,
      );
      setAllocationError(false);
    } catch {
      next[index] = amount;
      setAllocationError(true);
    }

    let financing = null;

    if (input.financing) {
      try {
        financing = allocateFinancing(input.financing, next);
      } catch {
        // Invalid allocations must be corrected before the server preview.
      }
    }

    setInput((previous) => ({ ...previous, installment_amounts_cents: next }));
    setPreview({
      ...preview,
      plan: {
        ...preview.plan,
        entries: preview.plan.entries.map((row, position) => ({
          ...row,
          amount_cents: next[position],
          financing: financing?.[position] ?? null,
        })),
      },
    });
    setPreviewDirty(true);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setCatalogFailed(false);
    setInvoiceChoicesFailed(false);
    setInvoices([]);
    setInvoiceChoices([]);
    const release = useFinancialOperations
      .getState()
      .begin('transaction-details');
    void Promise.all([
      window.api.getCreditCards(),
      input.card_id
        ? window.api.getCardInvoices(input.card_id)
        : Promise.resolve([]),
    ])
      .then(async ([cardRows, invoiceRows]) => {
        if (!active || !current()) {
          return;
        }

        setCards(cardRows);
        setInvoices(invoiceRows);
        const card = cardRows.find((row) => row.id === input.card_id);

        if (
          !plan &&
          credit &&
          card &&
          card.closing_day !== null &&
          card.includes_closing_day !== null &&
          card.due_days_after_closing !== null &&
          /^\d{4}-\d{2}-\d{2}$/.test(input.purchase_at)
        ) {
          try {
            const choices = await loadFirstInvoiceChoices(
              window.api,
              card.id,
              input.purchase_at,
              invoiceRows,
            );

            if (active && current()) {
              setInvoiceChoices(choices);
            }
          } catch {
            if (active && current()) {
              setInvoiceChoicesFailed(true);
            }
          }
        }
      })
      .catch(() => {
        if (active && current()) {
          setCatalogFailed(true);
        }
      })
      .finally(release);
    return () => {
      active = false;
    };
  }, [input.card_id, input.purchase_at, credit, catalogRevision]);
  async function act(save: boolean) {
    if (
      running.current ||
      catalogFailed ||
      allocationError ||
      financialActionsBlocked()
    ) {
      return;
    }

    if (!plan && (!credit || input.card_id === null)) {
      setError(t('installments.credit_required'));
      return;
    }

    if (
      !plan &&
      invoiceChoicesFailed &&
      !input.first_invoice_month &&
      !input.invoice_ids[0]
    ) {
      setError(t('installments.invoice_choices_error'));
      return;
    }

    running.current = true;
    setBusy(true);
    setError(null);
    const release = useFinancialOperations.getState().begin('mutation');
    let saved = false;
    try {
      if (plan) {
        await window.api.installment.rename(plan.id, input.name, input.note);
      } else if (save && preview) {
        if (occurrence) {
          const result = await window.api.recurrence.confirm({
            recurrence_id: occurrence.recurrence_id,
            scheduled_date: occurrence.scheduled_date,
            expected_version_id: occurrence.version_id,
            name: input.name,
            type: 2,
            amount_cents: input.total_amount_cents,
            category_id: input.category_id,
            payment_id: input.payment_id,
            credit_card_id: input.card_id,
            reference_date: input.purchase_at,
            installment: input,
            correction_token: preview.correction.token,
          });

          if (!result.ok) {
            throw new Error(result.error.message);
          }
        } else {
          await window.api.installment.create(input, preview.correction.token);
        }
      } else {
        const draft =
          financed && !input.financing
            ? { ...input, financing: emptyFinancing(input.total_amount_cents) }
            : input;
        const next = await window.api.installment.preview(draft);

        if (current()) {
          setInput(draft);
        }

        if (current()) {
          setPreview(next);
          setPreviewDirty(false);
        }

        return;
      }

      if (!current()) {
        return;
      }

      saved = true;
      await onSaved();

      if (current()) {
        onClose();
      }
    } catch (failure) {
      if (current()) {
        if (saved) {
          toast.add({
            title: t('common.error_title'),
            description: t('installments.refresh_error'),
          });
          onClose();
          return;
        }

        setError(installmentError(failure));

        if (String(failure).includes('stale_correction')) {
          setPreview(null);
        }
      }
    } finally {
      release();
      running.current = false;

      if (current()) {
        setBusy(false);
      }
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !running.current) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(plan ? 'installments.edit' : 'installments.add')}
          </DialogTitle>
          <DialogDescription>
            {t(
              occurrence
                ? 'financing.occurrence_hint'
                : 'installments.form_hint',
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act((!!preview && !previewDirty) || !!plan);
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy || blocked}
            inert={busy || blocked}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${prefix}-name`}>
                {t('transactions.name')}
              </FieldLabel>
              <Input
                id={`${prefix}-name`}
                autoFocus
                required
                maxLength={200}
                value={input.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </Field>
            {!plan && (
              <>
                <FieldMoney
                  disabled={financed}
                  label={t('installments.purchase_total')}
                  decimalSeparator={getLocale() === 'en-US' ? '.' : ','}
                  money={input.total_amount_cents / 100}
                  onMoneyChange={(value) =>
                    change({ total_amount_cents: Math.round(value * 100) })
                  }
                />
                {financed && (
                  <CreditFinancingFields
                    value={
                      input.financing ??
                      emptyFinancing(input.total_amount_cents)
                    }
                    onChange={(financing, total) =>
                      change({ financing, total_amount_cents: total })
                    }
                  />
                )}
                <Field>
                  <FieldLabel htmlFor={`${prefix}-count`}>
                    {t('installments.count')}
                  </FieldLabel>
                  <Input
                    id={`${prefix}-count`}
                    type="number"
                    min={2}
                    max={120}
                    step={1}
                    required
                    value={input.total_installments}
                    onChange={(event) =>
                      change({
                        total_installments: Number(event.target.value),
                        invoice_ids: [],
                      })
                    }
                  />
                </Field>
                <FieldDatePicker
                  label={t('installments.purchase_date')}
                  value={
                    input.purchase_at ? parseISO(input.purchase_at) : undefined
                  }
                  onValueChange={(value) =>
                    change({
                      purchase_at: value ? format(value, 'yyyy-MM-dd') : '',
                      start_date: value ? format(value, 'yyyy-MM-dd') : '',
                      first_invoice_month: null,
                      invoice_ids: [],
                    })
                  }
                />
                <FieldDatePicker
                  label={t('installments.first_date')}
                  value={
                    input.start_date ? parseISO(input.start_date) : undefined
                  }
                  onValueChange={(value) =>
                    change({
                      start_date: value ? format(value, 'yyyy-MM-dd') : '',
                    })
                  }
                />
                <Choice
                  label={t('transactions.category')}
                  value={input.category_id}
                  items={[
                    { value: 0, label: t('transactions.select_category') },
                    ...options.categories
                      .filter((row) => row.transaction_type !== 'income')
                      .map((row) => ({
                        value: row.id,
                        label: categoryLabel(row),
                      })),
                  ]}
                  onChange={(id) => change({ category_id: id })}
                />
                <Choice
                  label={t('transactions.payment')}
                  placeholder={t('transactions.select_payment')}
                  value={input.payment_id}
                  items={options.payments
                    .filter((row) => isCreditPayment(row.catalog_key))
                    .map((row) => ({
                      value: row.id,
                      label: t(`payments.${row.catalog_key}`),
                    }))}
                  onChange={(id) =>
                    change({
                      payment_id: id ?? 0,
                      total_amount_cents:
                        input.financing?.principal_cents ??
                        input.total_amount_cents,
                      financing: null,
                      card_id: null,
                      first_invoice_month: null,
                      invoice_ids: [],
                      use_invoice_opening_date: false,
                      add_day_to_invoice_opening_date: false,
                    })
                  }
                />
                {credit && (
                  <>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={input.use_invoice_opening_date ?? false}
                        onCheckedChange={(checked) =>
                          change({
                            use_invoice_opening_date: !!checked,
                            ...(!checked
                              ? { add_day_to_invoice_opening_date: false }
                              : {}),
                          })
                        }
                      />
                      {t('installments.invoice_opening_dates')}
                    </label>
                    {input.use_invoice_opening_date && (
                      <label className="ml-6 flex items-center gap-2 text-sm sm:col-span-2">
                        <Checkbox
                          checked={
                            input.add_day_to_invoice_opening_date ?? false
                          }
                          onCheckedChange={(checked) =>
                            change({
                              add_day_to_invoice_opening_date: !!checked,
                            })
                          }
                        />
                        {t('installments.add_day_to_invoice_opening_date')}
                      </label>
                    )}
                    {!occurrence && (
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <Checkbox
                          checked={input.historical_card}
                          onCheckedChange={(checked) =>
                            change({
                              historical_card: !!checked,
                              card_id: null,
                              first_invoice_month: null,
                              invoice_ids: [],
                            })
                          }
                        />
                        {t('installments.historical')}
                      </label>
                    )}
                    <Choice
                      label={t('cards.card')}
                      placeholder={t('cards.select_card')}
                      value={input.card_id}
                      items={cards
                        .filter(
                          (row) => input.historical_card || !row.archived_at,
                        )
                        .map((row) => ({ value: row.id, label: row.name }))}
                      onChange={(id) =>
                        change({
                          card_id: id,
                          invoice_ids: [],
                          first_invoice_month: null,
                        })
                      }
                    />
                    <FirstInvoiceField
                      choices={invoiceChoices}
                      selectedMonth={
                        input.first_invoice_month ??
                        invoices
                          .find((row) => row.id === input.invoice_ids[0])
                          ?.closing_date.slice(0, 7) ??
                        null
                      }
                      onChange={(month) =>
                        change({ first_invoice_month: month, invoice_ids: [] })
                      }
                    />
                    {invoiceChoicesFailed && (
                      <div role="alert" className="space-y-2 sm:col-span-2">
                        <p className="text-sm text-destructive">
                          {t('installments.invoice_choices_error')}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={blocked || busy}
                          onClick={() => {
                            if (
                              !financialActionsBlocked() &&
                              !running.current
                            ) {
                              setCatalogRevision((value) => value + 1);
                            }
                          }}
                        >
                          {t('common.retry')}
                        </Button>
                      </div>
                    )}
                    {input.card_id && (
                      <details className="rounded-lg border border-border p-3 sm:col-span-2">
                        <summary className="cursor-pointer text-sm">
                          {t('installments.invoice_mapping')}
                        </summary>
                        <p className="my-2 text-xs text-muted-foreground">
                          {t('installments.invoice_mapping_hint')}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {Array.from(
                            {
                              length: Math.min(
                                120,
                                Math.max(
                                  0,
                                  Math.floor(input.total_installments),
                                ),
                              ),
                            },
                            (_, index) => (
                              <Choice
                                key={index}
                                label={t('installments.position', {
                                  number: index + 1,
                                  count: input.total_installments,
                                })}
                                value={input.invoice_ids[index] ?? null}
                                items={[
                                  {
                                    value: 0,
                                    label: t('installments.automatic'),
                                  },
                                  ...invoices.map((row) => ({
                                    value: row.id,
                                    label: `#${row.id} · ${planDate(row.closing_date)}`,
                                  })),
                                ]}
                                onChange={(id) => {
                                  const next = [...input.invoice_ids];
                                  while (next.length <= index) {
                                    next.push(null);
                                  }
                                  next[index] = id;
                                  change({
                                    invoice_ids: next,
                                    ...(index === 0
                                      ? { first_invoice_month: null }
                                      : {}),
                                  });
                                }}
                              />
                            ),
                          )}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </>
            )}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${prefix}-note`}>
                {t('transactions.note')}
              </FieldLabel>
              <Input
                id={`${prefix}-note`}
                value={input.note ?? ''}
                onChange={(event) =>
                  change({ note: event.target.value || null })
                }
              />
            </Field>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {catalogFailed && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-destructive">
                {t('installments.load_error')}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={blocked || busy}
                onClick={() => {
                  if (!financialActionsBlocked() && !running.current) {
                    setCatalogRevision((value) => value + 1);
                  }
                }}
              >
                {t('common.retry')}
              </Button>
            </div>
          )}
          {allocationError && (
            <p role="alert" className="text-sm text-destructive">
              {t('installments.allocation_error')}
            </p>
          )}
          {preview && (
            <PlanPreview
              preview={preview}
              amountEditor={{
                locked,
                disabled: busy,
                onAmountChange: changeAmount,
                onLockChange: (index, value) => {
                  if (!running.current) {
                    setLocked((previous) =>
                      preview.plan.entries.map((_, position) =>
                        position === index
                          ? value
                          : (previous[position] ?? false),
                      ),
                    );
                  }
                },
              }}
            />
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                blocked ||
                busy ||
                catalogFailed ||
                allocationError ||
                (!plan &&
                  invoiceChoicesFailed &&
                  !input.first_invoice_month &&
                  !input.invoice_ids[0])
              }
            >
              {busy
                ? t('installments.working')
                : t(
                    plan || (preview && !previewDirty)
                      ? 'common.save'
                      : 'installments.preview',
                  )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
