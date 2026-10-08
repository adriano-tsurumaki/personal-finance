import AddTransaction from './AddTransaction';
import TimelineEntryRow from './TimelineEntryRow';
import MenuOptionsTransaction from './MenuOptionsTransaction';
import { useAppStore } from '@store/transaction';

export default function TimelineTransaction() {
  const transactions = useAppStore((s) => s.transactions);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            Transactions
          </h2>
          <p className="text-xs text-muted-foreground">
            {transactions.length}{' '}
            {transactions.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <AddTransaction />
      </div>

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
    </div>
  );
}
