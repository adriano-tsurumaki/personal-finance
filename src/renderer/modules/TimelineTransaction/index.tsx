import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useTimelinePreferences } from '@store/timeline-preferences';
import { ArrowDown, ArrowUp, Repeat, ReceiptText } from 'lucide-react';
import { OccurrenceSummary } from '@modules/Recurrences';
import AddTransaction from './AddTransaction';
import TimelineEntryRow from './TimelineEntryRow';
import MenuOptionsTransaction from './MenuOptionsTransaction';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';
import { Button } from '@components/ui/button';
import { cardDate } from '@lib/card-corrections';
import { formatSignedCurrency } from '@lib/format/currency';
import SummaryStat from '@modules/MonthlyFinance/SummaryStat';
import { referenceSummary } from './reference-summary';

export default function TimelineTransaction({
  onReviewRecurrences,
  onCreateInstallment,
}: {
  onReviewRecurrences?: () => void;
  onCreateInstallment?: () => void;
}) {
  const newestFirst = useTimelinePreferences((state) => state.newestFirst);
  const toggleDateOrder = useTimelinePreferences(
    (state) => state.toggleDateOrder,
  );
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const recurrence = useAppStore((state) => state.recurrenceMonth);
  const projected =
    recurrence?.occurrences.filter((row) => row.state === 'unconfirmed') ?? [];
  const transactions = useAppStore((s) => s.transactions);
  const payments = useAppStore((s) => s.invoicePayments);
  const entryCount = transactions.length + projected.length + payments.length;
  const loading = useAppStore((s) => s.transactionsLoading);
  const failed = useAppStore((s) => s.transactionsFailed);
  const summary = referenceSummary(transactions, recurrence?.occurrences ?? []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {t('monthly_views.entries_hint')}
      </p>
      <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          available={!loading && !failed && summary !== null}
          label={t('monthly_views.reference_income')}
          value={summary?.income ?? 0}
          tone="income"
        />
        <SummaryStat
          available={!loading && !failed && summary !== null}
          label={t('monthly_views.reference_expense')}
          value={summary?.expense ?? 0}
          tone="expense"
        />
        <SummaryStat
          available={!loading && !failed && summary !== null}
          label={t('monthly_views.reference_net')}
          value={summary?.net ?? 0}
          tone="neutral"
        />
      </dl>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t('transactions.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              entryCount === 1
                ? 'transactions.entries_one'
                : 'transactions.entries_other',
              { count: entryCount },
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCreateInstallment && (
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() => {
                if (!financialActionsBlocked()) {
                  onCreateInstallment();
                }
              }}
            >
              {t('installments.add')}
            </Button>
          )}
          <AddTransaction />
        </div>
      </div>

      {!loading &&
        !failed &&
        recurrence &&
        recurrence.unconfirmed_count > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">
              {t('recurrence.notice', {
                count: recurrence.unconfirmed_count,
                month: recurrence.month,
              })}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={blocked}
              onClick={() => {
                if (!financialActionsBlocked()) {
                  onReviewRecurrences?.();
                }
              }}
            >
              <Repeat aria-hidden="true" />
              {t('recurrence.review')}
            </Button>
          </div>
        )}
      {!loading && !failed && entryCount > 0 && (
        <div className="mb-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('transactions.toggle_date_order')}
            aria-pressed={newestFirst}
            disabled={entryCount < 2}
            onClick={toggleDateOrder}
          >
            {newestFirst ? (
              <ArrowUp aria-hidden="true" />
            ) : (
              <ArrowDown aria-hidden="true" />
            )}
            {t(
              newestFirst
                ? 'transactions.newest_first'
                : 'transactions.oldest_first',
            )}
          </Button>
        </div>
      )}
      {loading ? (
        <p
          role="status"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {t('common.loading')}
        </p>
      ) : failed ? (
        <div
          role="alert"
          className="rounded-lg border border-dashed border-border p-6 text-center"
        >
          <p className="mb-3 text-sm text-destructive">{t('common.error')}</p>
          <Button
            variant="outline"
            onClick={() => {
              void useAppStore
                .getState()
                .refreshMonth()
                .catch(() => {});
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : entryCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <h3 className="text-sm font-medium">{t('transactions.empty')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('transactions.empty_hint')}
          </p>
        </div>
      ) : (
        <div className="relative">
          <span
            className="absolute bottom-4 left-5.5 top-2 w-px bg-border"
            aria-hidden="true"
          />
          <ol>
            {[
              ...payments.map((entry) => ({
                kind: 'invoice_payment' as const,
                date: entry.paid_at,
                entry,
              })),
              ...transactions.map((entry) => ({
                kind: 'transaction' as const,
                date: entry.reference_date,
                entry,
              })),
              ...projected.map((entry) => ({
                kind: 'projection' as const,
                date: entry.scheduled_date,
                entry,
              })),
            ]
              .sort((a, b) =>
                newestFirst
                  ? b.date.localeCompare(a.date)
                  : a.date.localeCompare(b.date),
              )
              .map((row) =>
                row.kind === 'invoice_payment' ? (
                  <li
                    key={`invoice-payment:${row.entry.invoice_id}`}
                    className="relative flex gap-4 py-3 pl-1 pr-2"
                  >
                    <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
                      <ReceiptText className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t('cards.payment_event', {
                          card: row.entry.card_name,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={row.date}>{cardDate(row.date)}</time> ·{' '}
                        {t('cards.invoice')} #{row.entry.invoice_id} ·{' '}
                        {cardDate(row.entry.closing_date)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('cards.payment_event_hint')}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-expense">
                      {formatSignedCurrency(
                        row.entry.amount_cents / 100,
                        'expense',
                      )}
                    </span>
                  </li>
                ) : row.kind === 'projection' ? (
                  <li
                    className="relative my-2 ml-1 rounded-lg border border-dashed border-border bg-card p-4"
                    key={`projection:${row.entry.recurrence_id}:${row.date}`}
                  >
                    <OccurrenceSummary occurrence={row.entry} />
                  </li>
                ) : (
                  <MenuOptionsTransaction
                    key={row.entry.id}
                    transactionId={row.entry.id}
                    installment={!!row.entry.installment_id}
                  >
                    {(actions) => (
                      <TimelineEntryRow entry={row.entry} {...actions} />
                    )}
                  </MenuOptionsTransaction>
                ),
              )}
          </ol>
        </div>
      )}
    </div>
  );
}
