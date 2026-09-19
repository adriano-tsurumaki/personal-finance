import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import TimelineEntryRow from './TimelineEntryRow';
import { formatYearMonthToString } from '@lib/format/currency';

import { useAppStore } from '@store/transaction';
import { shiftMonth } from '@shared/lib/calc';

export default function MonthlyFinance(): React.JSX.Element {
  const transactions = useAppStore((s) => s.transactions);
  const monthKey = useAppStore((s) => s.monthKey);
  const setMonthKey = useAppStore((s) => s.setMonthKey);

  const [year, month] = monthKey.split('-').map(Number);

  return (
    <section>
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-10 sm:px-8">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Wallet className="size-4" aria-hidden="true" />
            <span>Ledger</span>
          </div>

          {/* Month navigator */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
              aria-label="Previous month"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="text-center">
              <h1 className="text-lg font-semibold text-foreground">
                {formatYearMonthToString(year, month)}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
              aria-label="Next month"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Transactions for the selected month */}
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Transactions
          </h2>
          <p className="text-xs text-muted-foreground">
            {transactions.length}{' '}
            {transactions.length === 1 ? 'entry' : 'entries'}
          </p>
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
    </section>
  );
}
