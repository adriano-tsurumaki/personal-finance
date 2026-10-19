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

export default function PlanDialog({
  month,
  plan,
  onClose,
  onSaved,
}: {
  month: string;
  plan?: InstallmentPlanDto;
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
  }));
  const [cards, setCards] = useState<CreditCardDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [preview, setPreview] = useState<InstallmentPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [allocationError, setAllocationError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const alive = useRef(false);
  const running = useRef(false);
  const current = () =>
    alive.current && session === useProfileStore.getState().sessionVersion;
  const credit =
    options.payments.find((row) => row.id === input.payment_id)?.catalog_key ===
    'credit';
  const prefix = useId();
  function change(next: Partial<InstallmentInput>) {
    if (running.current) {
      return;
    }

    const resetAmounts =
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

    setInput((previous) => ({ ...previous, installment_amounts_cents: next }));
    setPreview({
      ...preview,
      plan: {
        ...preview.plan,
        entries: preview.plan.entries.map((row, position) => ({
          ...row,
          amount_cents: next[position],
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
    setInvoices([]);
    const release = useFinancialOperations
      .getState()
      .begin('transaction-details');
    void Promise.all([
      window.api.getCreditCards(),
      input.card_id
        ? window.api.getCardInvoices(input.card_id)
        : Promise.resolve([]),
    ])
      .then(([cardRows, invoiceRows]) => {
        if (active && current()) {
          setCards(cardRows);
          setInvoices(invoiceRows);
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
  }, [input.card_id, catalogRevision]);
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

    running.current = true;
    setBusy(true);
    setError(null);
    const release = useFinancialOperations.getState().begin('mutation');
    let saved = false;
    try {
      if (plan) {
        await window.api.installment.rename(plan.id, input.name, input.note);
      } else if (save && preview) {
        await window.api.installment.create(input, preview.correction.token);
      } else {
        const next = await window.api.installment.preview(input);

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
          <DialogDescription>{t('installments.form_hint')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act((!!preview && !previewDirty) || !!plan);
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy}
            inert={busy}
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
                  label={t('installments.purchase_total')}
                  decimalSeparator={getLocale() === 'en-US' ? '.' : ','}
                  money={input.total_amount_cents / 100}
                  onMoneyChange={(value) =>
                    change({ total_amount_cents: Math.round(value * 100) })
                  }
                />
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
                    .filter((row) => row.catalog_key === 'credit')
                    .map((row) => ({
                      value: row.id,
                      label: t(`payments.${row.catalog_key}`),
                    }))}
                  onChange={(id) =>
                    change({
                      payment_id: id ?? 0,
                      card_id: null,
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
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={input.historical_card}
                        onCheckedChange={(checked) =>
                          change({
                            historical_card: !!checked,
                            card_id: null,
                            invoice_ids: [],
                          })
                        }
                      />
                      {t('installments.historical')}
                    </label>
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
                        change({ card_id: id, invoice_ids: [] })
                      }
                    />
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
                                  change({ invoice_ids: next });
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
              disabled={blocked || busy || catalogFailed || allocationError}
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
