import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@components/ui/button';
import { formatYearMonthToString } from '@lib/format/currency';
import { t } from '@lib/i18n';
import { shiftMonth } from '@shared/lib/calc';

export default function MonthNavigator({
  month,
  disabled = false,
  onChange,
}: {
  month: string;
  disabled?: boolean;
  onChange: (month: string) => void;
}) {
  const [year, number] = month.split('-').map(Number);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={t('summary.previous')}
        onClick={() => {
          if (!disabled) {
            onChange(shiftMonth(month, -1));
          }
        }}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <time
        dateTime={month}
        aria-live="polite"
        aria-atomic="true"
        className="min-w-28 text-center text-sm font-medium tabular-nums"
      >
        {formatYearMonthToString(year, number)}
      </time>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={t('summary.next')}
        onClick={() => {
          if (!disabled) {
            onChange(shiftMonth(month, 1));
          }
        }}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
