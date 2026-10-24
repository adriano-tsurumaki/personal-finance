import { Repeat, CalendarDays } from 'lucide-react';
import { t, getLocale } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';
import { useProfileStore } from '@store/profile';
import { getCategoryIcon } from '@lib/category-icons';
export function occurrenceDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(getLocale());
}
export function OccurrenceSummary({
  occurrence: row,
  compact = false,
}: {
  occurrence: RecurrenceOccurrenceDto;
  compact?: boolean;
}) {
  const category = useProfileStore((state) =>
    state.options.categories.find(
      (category) => category.id === row.category_id,
    ),
  );
  const Icon = getCategoryIcon(category?.icon_key);
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${compact ? 'size-8' : 'size-10'} ${row.type === 1 ? 'bg-income/10 text-income' : 'bg-primary/10 text-primary'}`}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="wrap-break-words text-sm font-semibold">{row.name}</p>
          <span
            className={`shrink-0 font-mono text-sm tabular-nums ${row.type === 1 ? 'text-income' : 'text-expense'}`}
          >
            {formatCurrency(row.amount_cents / 100)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {!compact && (
            <CalendarDays className="mr-1 inline size-3" aria-hidden="true" />
          )}
          {!compact && (
            <>
              <time dateTime={row.scheduled_date}>
                {occurrenceDate(row.scheduled_date)}
              </time>{' '}
              ·{' '}
            </>
          )}
          <Repeat className="inline size-3" aria-hidden="true" />{' '}
          {t(`recurrence.${row.state}`)} · #{row.recurrence_id}
        </p>
        {row.actual_reference_date &&
          row.actual_reference_date !== row.scheduled_date && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('recurrence.actual_date', {
                date: occurrenceDate(row.actual_reference_date),
              })}
            </p>
          )}
        {!compact && row.cash_flow_date && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('recurrence.cash_flow', {
              date: occurrenceDate(row.cash_flow_date),
            })}
          </p>
        )}
        {row.coverage === 'unknown' && (
          <p role="status" className="mt-2 text-xs text-expense">
            {t('recurrence.unknown_coverage')}
          </p>
        )}
        {row.issue && row.coverage !== 'unknown' && (
          <p className="mt-2 text-xs text-expense">
            {t('recurrence.repair_hint')}
          </p>
        )}
      </div>
    </div>
  );
}
