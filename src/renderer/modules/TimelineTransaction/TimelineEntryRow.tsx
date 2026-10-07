import { getCategoryIcon } from '@lib/category-icons';
import { formatSignedCurrency } from '@lib/format/currency';
import type { TransactionDto } from '@shared/contracts/transaction';

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}

export default function TimelineEntryRow({
  entry,
}: {
  entry: TransactionDto;
}): React.JSX.Element {
  const isIncome = entry.type === 1;
  const Icon = getCategoryIcon(entry.category?.icon_key);
  const nodeClass = isIncome
    ? 'border-income/30 bg-income/10 text-income'
    : 'border-border bg-secondary text-muted-foreground';
  const amountClass = isIncome ? 'text-income' : 'text-expense';

  return (
    <li className="relative flex gap-4 pl-1">
      <div className="relative z-10 flex shrink-0 flex-col items-center">
        <span
          className="absolute inset-0 size-9 rounded-full bg-background z-0"
          aria-hidden="true"
        />
        <span
          className={`relative z-10 flex size-9 items-center justify-center rounded-full border ${nodeClass}`}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">
                {entry.name}
              </p>
              {entry.category?.name ? (
                <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground sm:inline">
                  {entry.category?.name}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <time dateTime={entry.reference_date}>
                {dayLabel(entry.reference_date)}
              </time>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`font-mono text-sm font-semibold tabular-nums ${amountClass}`}
            >
              {formatSignedCurrency(
                entry.amount_cents / 100,
                isIncome ? 'income' : 'expense',
              )}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
