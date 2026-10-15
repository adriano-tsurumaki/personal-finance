import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { Repeat } from 'lucide-react';
import { OccurrenceSummary } from '@modules/Recurrences';
import AddTransaction from './AddTransaction';
import TimelineEntryRow from './TimelineEntryRow';
import MenuOptionsTransaction from './MenuOptionsTransaction';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';
import { Button } from '@components/ui/button';

export default function TimelineTransaction({
  onReviewRecurrences,
}: {
  onReviewRecurrences?: () => void;
}) {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const recurrence = useAppStore((state) => state.recurrenceMonth);
  const projected =
    recurrence?.occurrences.filter((row) => row.state === 'unconfirmed') ?? [];
  const transactions = useAppStore((s) => s.transactions);
  const loading = useAppStore((s) => s.transactionsLoading);
  const failed = useAppStore((s) => s.transactionsFailed);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t('transactions.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              transactions.length + projected.length === 1
                ? 'transactions.entries_one'
                : 'transactions.entries_other',
              { count: transactions.length + projected.length },
            )}
          </p>
        </div>
        <AddTransaction />
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
      ) : transactions.length === 0 && projected.length === 0 ? (
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
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((row) =>
                row.kind === 'projection' ? (
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
