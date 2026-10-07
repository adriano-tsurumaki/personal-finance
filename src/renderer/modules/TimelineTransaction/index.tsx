import AddTransaction from './AddTransaction';
import TimelineEntryRow from './TimelineEntryRow';
import { useAppStore } from '@store/transaction';

export default function TimelineTransaction() {
  const transactions = useAppStore((s) => s.transactions);
  const monthlyStatement = useAppStore((s) => s.monthlyStatement);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            Transactions
          </h2>
          <p className="text-xs text-muted-foreground">
            {monthlyStatement.transactionCount}{' '}
            {monthlyStatement.transactionCount === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <AddTransaction />
      </div>

      <ol className="relative">
        <span
          className="absolute bottom-4 left-5.5 top-2 w-px bg-border"
          aria-hidden="true"
        />
        {transactions.map((entry) => (
          <TimelineEntryRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </div>
  );
}
