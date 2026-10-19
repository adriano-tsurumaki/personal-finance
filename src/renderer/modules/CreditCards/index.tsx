import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Archive,
  CreditCard,
  Pencil,
  Plus,
  Link2,
  Trash2,
  ReceiptText,
  History,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import { Field, FieldLabel } from '@components/ui/field';
import { getLocale, t, type TranslationKey } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { cardDate } from '@lib/card-corrections';
import { creditCardStore, useCreditCardStore } from '@store/credit-cards';
import { dialogTransactionStore } from '@store/dialog-transaction';
import { useProfileStore } from '@store/profile';
import { useAppStore } from '@store/transaction';
import { confirmation } from '@store/confirmation';
import MenuOptionsTransaction from '@modules/TimelineTransaction/MenuOptionsTransaction';
import type {
  CreditCardDto,
  InvoiceEntryDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import CardChanges from '@components/CardChanges';
import CardDialog from './CardDialog';
import InvoiceDialog from './InvoiceDialog';
import InvoicePaymentDialog from './InvoicePaymentDialog';
import AssociationDialog from './AssociationDialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

const operationKeys = [
  'pay_invoice',
  'correct_invoice_payment',
  'undo_invoice_payment',
  'create_card',
  'rename_card',
  'archive_card',
  'create_invoice',
  'register_invoice',
  'correct_invoice',
  'create_purchase',
  'update_purchase',
  'delete_purchase',
  'associate_purchase',
  'create_installment_plan',
  'rename_installment_plan',
  'delete_installment_plan',
];

export default function CreditCards() {
  const id = useId();
  const state = useCreditCardStore((value) => value);
  const session = useProfileStore((value) => value.sessionVersion);
  const [editor, setEditor] = useState<CreditCardDto | 'new' | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<'new' | 'edit' | null>(
    null,
  );
  const [association, setAssociation] = useState<InvoiceEntryDto | null>(null);
  const [period, setPeriod] = useState<InvoicePeriodDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentEditor, setPaymentEditor] = useState(false);
  const blocked = useFinancialOperations((value) => value.pending.size > 0);
  const returnFocus = useRef<HTMLButtonElement>(null);
  const card = state.cards.find((value) => value.id === state.cardId);
  const invoice = state.details?.invoice;
  const current = () => useProfileStore.getState().sessionVersion === session;

  useEffect(() => {
    void creditCardStore.getState().refresh();
  }, []);

  useEffect(() => {
    let active = true;
    setPeriod(null);

    if (state.cardId !== null) {
      void window.api
        .previewInvoicePeriod(state.cardId, state.periodMonth)
        .then((value) => {
          if (active && current()) {
            setPeriod(value);
          }
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [state.cardId, state.periodMonth, session]);

  async function refreshed() {
    await Promise.all([
      creditCardStore.getState().refresh(),
      useAppStore.getState().refreshMonth(),
    ]);
  }

  async function archive() {
    if (!card || busy || financialActionsBlocked()) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    setBusy(true);
    try {
      if (
        !(await confirmation.confirm({
          title: t('cards.archive'),
          description: t('cards.archive_hint'),
        })) ||
        !current()
      ) {
        return;
      }

      await window.api.archiveCreditCard(card.id);

      if (current()) {
        await refreshed();
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

  function addPurchase() {
    const store = dialogTransactionStore.getState();
    const method = useProfileStore
      .getState()
      .options.payments.find((value) => value.catalog_key === 'credit');

    if (!card || !method || store.isSubmitting) {
      return;
    }

    store.openDialogTransaction();
    store.handleTransaction('type', 2);
    store.handleTransaction('payment_id', method.id);
    store.handleTransaction('card_id', card.id);
    store.handleTransaction('credit_card_invoice_id', invoice?.id ?? null);
    store.handleTransaction('historical_card', !!card.archived_at);
    store.handleTransaction(
      'reference_date',
      invoice?.opening_date ?? `${state.periodMonth}-01`,
    );
  }

  function entries(rows: InvoiceEntryDto[]) {
    return (
      <ul className="divide-y divide-border">
        {rows.map((entry) => (
          <MenuOptionsTransaction
            key={entry.id}
            transactionId={entry.id}
            installment={!!entry.installment_id}
          >
            {(actions) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cardDate(entry.reference_date)}
                    {entry.installment_number
                      ? ` · ${entry.installment_number}/${entry.total_installments ?? '?'}`
                      : ''}
                  </p>
                  {entry.outside_period && (
                    <p className="text-xs text-muted-foreground">
                      {t('cards.outside_period')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">
                    {formatCurrency(entry.amount_cents / 100)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t('cards.associate_label', {
                      name: entry.name,
                    })}
                    title={t('cards.associate')}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      setAssociation(entry);
                    }}
                    disabled={actions.disabled || !!entry.installment_id}
                  >
                    <Link2 aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t('transactions.edit_label', {
                      name: entry.name,
                    })}
                    title={t('common.edit')}
                    onClick={actions.onEdit}
                    disabled={actions.disabled || !!entry.installment_id}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-expense"
                    aria-label={t('transactions.remove_label', {
                      name: entry.name,
                    })}
                    title={t('common.remove')}
                    onClick={actions.onRemove}
                    disabled={actions.disabled || !!entry.installment_id}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </MenuOptionsTransaction>
        ))}
      </ul>
    );
  }

  const today = new Date().toLocaleDateString('en-CA');
  return (
    <section
      className="mx-auto max-w-3xl px-5 py-8 sm:px-8"
      aria-labelledby={`${id}-heading`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id={`${id}-heading`}
            className="flex items-center gap-2 font-semibold"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {t('cards.title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('cards.period_hint')}
          </p>
        </div>
        <Button
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setEditor('new');
          }}
        >
          <Plus aria-hidden="true" />
          {t('cards.new_card')}
        </Button>
      </div>
      {state.failed && (
        <div role="alert" className="mb-4">
          <p>{t('common.error')}</p>
          <Button variant="outline" onClick={() => void state.refresh()}>
            {t('common.retry')}
          </Button>
        </div>
      )}
      {state.loading && (
        <p role="status" className="mb-3 text-sm">
          {t('common.loading')}
        </p>
      )}
      {!state.cards.length && !state.loading ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {t('cards.no_cards')}
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor={`${id}-card`}>{t('cards.card')}</FieldLabel>

          <Select<number>
            items={state.cards.map((card) => ({
              value: card.id,
              label: card.name,
            }))}
            value={state.cardId}
            onValueChange={(value) => {
              if (!financialActionsBlocked()) {
                void state.selectCard(value);
              }
            }}
            disabled={blocked}
          >
            <SelectTrigger id={`${id}-card`}>
              <SelectValue placeholder={t('cards.select_card')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {state.cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                    {card.archived_at ? ` (${t('cards.archived')})` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}
      {card && (
        <>
          <div className="my-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={(event) => {
                returnFocus.current = event.currentTarget;
                setEditor(card);
              }}
            >
              <Pencil aria-hidden="true" />
              {t('cards.rename')}
            </Button>
            <Button
              variant="outline"
              disabled={blocked || busy || !!card.archived_at}
              onClick={() => void archive()}
            >
              <Archive aria-hidden="true" />
              {t('cards.archive')}
            </Button>
            <Button
              variant="outline"
              onClick={(event) => {
                returnFocus.current = event.currentTarget;
                setInvoiceEditor('new');
              }}
            >
              <ReceiptText aria-hidden="true" />
              {t('cards.historical_invoice')}
            </Button>
            <Button variant="outline" onClick={addPurchase}>
              <Plus aria-hidden="true" />
              {t('cards.entry')}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-month`}>
                {t('cards.period_month')}
              </FieldLabel>
              <Input
                id={`${id}-month`}
                type="month"
                disabled={blocked}
                value={state.periodMonth}
                onChange={(event) => {
                  if (!financialActionsBlocked()) {
                    state.setPeriodMonth(event.target.value);
                  }
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-invoice`}>
                {t('cards.invoice')}
              </FieldLabel>

              <Select<number>
                items={state.invoices.map((invoice) => ({
                  value: invoice.id,
                  label: `${cardDate(invoice.closing_date)} · ${formatCurrency(invoice.amount_cents / 100)} · #${invoice.id}`,
                }))}
                value={state.invoiceId}
                onValueChange={(value) => {
                  if (!financialActionsBlocked()) {
                    void state.selectInvoice(value);
                  }
                }}
                disabled={blocked}
              >
                <SelectTrigger id={`${id}-invoice`}>
                  <SelectValue placeholder={t('cards.select_invoice')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {state.invoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {cardDate(invoice.closing_date)} ·{' '}
                        {formatCurrency(invoice.amount_cents / 100)} · #
                        {invoice.id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {!invoice && period && (
            <p className="my-4 rounded-lg bg-secondary p-3 text-sm">
              {t('cards.preview')}: {cardDate(period.opening_date)} →{' '}
              {cardDate(period.closing_date)} · {t('cards.due')}:{' '}
              {cardDate(period.due_date)}
            </p>
          )}
          {!state.invoices.length && !state.loading && (
            <p className="my-4 text-sm text-muted-foreground">
              {t('cards.no_invoices')}
            </p>
          )}
        </>
      )}
      {invoice && state.details && (
        <article className="mt-6 rounded-xl border border-border p-4 sm:p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {t('cards.invoice')} · {cardDate(invoice.closing_date)}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  invoice.paid_at
                    ? 'cards.paid'
                    : invoice.due_date < today
                      ? 'cards.overdue'
                      : 'cards.unpaid',
                )}
                {invoice.paid_at ? ` · ${cardDate(invoice.paid_at)}` : ''} ·{' '}
                {t(
                  invoice.closing_date < today
                    ? 'cards.closed'
                    : invoice.opening_date && invoice.opening_date > today
                      ? 'cards.upcoming'
                      : 'cards.open',
                )}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={(event) => {
                returnFocus.current = event.currentTarget;
                setInvoiceEditor('edit');
              }}
            >
              <Pencil aria-hidden="true" />
              {t('cards.correct_invoice_action')}
            </Button>
            <Button
              disabled={blocked || state.loading || state.failed}
              onClick={(event) => {
                if (financialActionsBlocked()) {
                  return;
                }

                returnFocus.current = event.currentTarget;
                setPaymentEditor(true);
              }}
            >
              {t(
                invoice.paid_at
                  ? 'cards.manage_payment'
                  : 'cards.confirm_payment',
              )}
            </Button>
          </div>
          <dl className="my-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              [t('cards.opening'), cardDate(invoice.opening_date)],
              [t('cards.closing'), cardDate(invoice.closing_date)],
              [t('cards.due'), cardDate(invoice.due_date)],
              [t('cards.total'), formatCurrency(invoice.amount_cents / 100)],
              [
                t('cards.items_total'),
                formatCurrency(invoice.items_total_cents / 100),
              ],
              [
                t('cards.difference'),
                formatCurrency(invoice.difference_cents / 100),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            {t('cards.total_source')}: {t(`cards.${invoice.total_source}`)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('cards.includes_closing')}:{' '}
            {invoice.includes_closing_day === null
              ? t('cards.unknown')
              : t(invoice.includes_closing_day ? 'cards.yes' : 'cards.no')}
          </p>
          {invoice.total_source === 'statement' && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('cards.statement_hint')}
            </p>
          )}
          <div className="mt-4">
            {state.details.entries.length ? (
              entries(state.details.entries)
            ) : (
              <p className="py-5 text-sm text-muted-foreground">
                {t('cards.no_entries')}
              </p>
            )}
          </div>
          <details className="mt-4 border-t border-border pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <History
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {t('cards.history')}
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] tabular-nums">
                {state.details.history.length}
              </span>
            </summary>
            {!state.details.history.length && (
              <p className="mt-3 text-sm">{t('cards.no_history')}</p>
            )}
            {state.details.history.map((change) => (
              <details
                key={change.id}
                className="group/history mt-3 overflow-hidden rounded-lg border border-border bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 text-xs [&::-webkit-details-marker]:hidden">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                    <History
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <time
                      className="text-[11px] text-muted-foreground"
                      dateTime={change.created_at}
                    >
                      {new Date(change.created_at).toLocaleString(getLocale())}
                    </time>
                    <span className="font-medium">
                      {t(
                        (operationKeys.includes(change.operation)
                          ? `cards.${change.operation}`
                          : 'cards.history') as TranslationKey,
                      )}
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open/history:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-border p-3">
                  <CardChanges changes={change.changes} />
                </div>
              </details>
            ))}
          </details>
        </article>
      )}
      {!!state.unlinked.length && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold">{t('cards.unlinked')}</h3>
          {entries(state.unlinked)}
        </section>
      )}
      {editor && (
        <CardDialog
          returnFocus={returnFocus}
          card={editor}
          onClose={() => setEditor(null)}
          onSaved={async (savedId) => {
            if (current()) {
              await creditCardStore.getState().selectCard(savedId);
            }
          }}
        />
      )}
      {invoiceEditor && state.cardId !== null && (
        <InvoiceDialog
          returnFocus={returnFocus}
          cardId={state.cardId}
          month={
            invoiceEditor === 'edit' && invoice
              ? invoice.closing_date.slice(0, 7)
              : state.periodMonth
          }
          invoice={invoiceEditor === 'edit' ? (invoice ?? null) : null}
          onClose={() => setInvoiceEditor(null)}
          onSaved={async (savedId) => {
            if (current()) {
              await state.selectInvoice(savedId);
              await refreshed();
            }
          }}
        />
      )}
      {association && (
        <AssociationDialog
          returnFocus={returnFocus}
          entry={association}
          cards={state.cards}
          initialCard={state.cardId}
          onClose={() => setAssociation(null)}
          onSaved={refreshed}
        />
      )}
      {paymentEditor && invoice && (
        <InvoicePaymentDialog
          key={invoice.id}
          invoice={invoice}
          returnFocus={returnFocus}
          onClose={() => setPaymentEditor(false)}
          onSaved={refreshed}
        />
      )}
    </section>
  );
}
