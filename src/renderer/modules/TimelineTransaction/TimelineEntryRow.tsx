import { getCategoryIcon } from '@lib/category-icons';
import { formatSignedCurrency } from '@lib/format/currency';
import type { TransactionDto } from '@shared/contracts/transaction';
import { Button } from '@components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { categoryLabel, getLocale, t } from '@lib/i18n';

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(getLocale(), {
    day: '2-digit',
    month: 'short',
  });
}

export default function TimelineEntryRow({
  entry,
  onEdit,
  onRemove,
  disabled,
}: {
  entry: TransactionDto;
  onEdit: () => Promise<void>;
  onRemove: () => Promise<void>;
  disabled: boolean;
}): React.JSX.Element {
  const isIncome = entry.type === 1;
  const Icon = getCategoryIcon(entry.category?.icon_key);
  const nodeClass = isIncome
    ? 'border-income/30 bg-income/10 text-income'
    : 'border-border bg-secondary text-muted-foreground';
  const amountClass = isIncome ? 'text-income' : 'text-expense';

  return (
    <div className="relative flex gap-4 py-2 pl-1 pr-2">
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

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">
                {entry.name}
              </p>
              {entry.category?.name ? (
                <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground sm:inline">
                  {categoryLabel(entry.category)}
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
            <div className="mt-1 flex h-6 justify-end gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover/transaction:opacity-100 group-hover/transaction:pointer-events-auto group-has-[:focus-visible]/transaction:opacity-100 group-has-[:focus-visible]/transaction:pointer-events-auto motion-reduce:transition-none">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:bg-secondary"
                aria-label={t('transactions.editLabel', { name: entry.name })}
                title={t('transactions.edit')}
                onClick={onEdit}
                disabled={disabled}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:bg-secondary hover:text-expense"
                aria-label={t('transactions.removeLabel', { name: entry.name })}
                title={t('transactions.remove')}
                onClick={onRemove}
                disabled={disabled}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
