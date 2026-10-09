import AddTransaction from './AddTransaction';
import EditTransaction from './EditTransaction';
import TimelineEntryRow from './TimelineEntryRow';
import MenuOptionsTransaction from './MenuOptionsTransaction';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';
import { Button } from '@components/ui/button';

export default function TimelineTransaction() {
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
              transactions.length === 1
                ? 'transactions.entries_one'
                : 'transactions.entries_other',
              { count: transactions.length },
            )}
          </p>
        </div>
        <AddTransaction />
        <EditTransaction />
      </div>

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
                .loadTransactions()
                .catch(() => {});
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <h3 className="text-sm font-medium">{t('transactions.empty')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('transactions.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="relative">
          <span
            className="absolute bottom-4 left-5.5 top-2 w-px bg-border"
            aria-hidden="true"
          />
          <ol>
            {transactions.map((entry) => (
              <MenuOptionsTransaction key={entry.id} transactionId={entry.id}>
                {(actions) => <TimelineEntryRow entry={entry} {...actions} />}
              </MenuOptionsTransaction>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
