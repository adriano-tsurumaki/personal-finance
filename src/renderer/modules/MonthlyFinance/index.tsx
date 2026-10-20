import SummaryStat from './SummaryStat';
import { formatCompactCurrency } from '@lib/format/currency';
import { useFinancialOperations } from '@store/financial-operations';
import { useMonthlyStatementFeedback } from './use-monthly-statement-feedback';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import OdometerMoney from '@components/OdometerMoney';
import { formatYearMonthToString } from '@lib/format/currency';
import { useAppStore } from '@store/transaction';
import { shiftMonth } from '@shared/lib/calc';
import ProfileHeader from '@modules/Profiles/ProfileHeader';
import { t } from '@lib/i18n';

export default function MonthlyFinance(): React.JSX.Element {
  const monthlyStatement = useAppStore((s) => s.monthlyStatement);
  const monthKey = useAppStore((s) => s.monthKey);
  const setMonthKey = useAppStore((s) => s.setMonthKey);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const loaded = useAppStore((s) => s.statementLoaded);
  const statementLoading = useAppStore((s) => s.statementLoading);
  const anchor = useAppStore((s) => s.indicatorAnchor);
  const statementIssue = useAppStore((s) => s.statementIssue);
  useMonthlyStatementFeedback();
  const [year, month] = monthKey.split('-').map(Number);

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-3xl px-5 pb-8 pt-10 sm:px-8">
        <ProfileHeader />
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={blocked}
            onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
            aria-label={t('summary.previous')}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {formatYearMonthToString(year, month)}
          </h1>
          <button
            type="button"
            disabled={blocked}
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            aria-label={t('summary.next')}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div
          aria-busy={statementLoading}
          className="mt-6 flex flex-col gap-1.5"
        >
          <p className="text-sm text-muted-foreground">
            {t('summary.balance')}
          </p>
          <p className="font-mono text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
            {loaded ? (
              <OdometerMoney value={monthlyStatement.closingBalance} />
            ) : (
              '—'
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('summary.opening_balance')}{' '}
            <span className="font-mono tabular-nums">
              {loaded ? (
                <OdometerMoney value={monthlyStatement.openingBalance} />
              ) : (
                '—'
              )}
            </span>
          </p>
        </div>
        <dl className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryStat
            available={loaded}
            label={t('monthly_views.inflows')}
            value={monthlyStatement.income}
            tone="income"
            icon={<ArrowUpRight className="size-4" />}
          />
          <SummaryStat
            available={loaded}
            label={t('monthly_views.outflows')}
            value={monthlyStatement.expense}
            tone="expense"
            icon={<ArrowDownRight className="size-4" />}
          />
          <SummaryStat
            available={loaded}
            label={t('summary.saved')}
            value={monthlyStatement.savingsRate}
            format={{ style: 'percent', maximumFractionDigits: 0 }}
            tone="neutral"
            hint={formatCompactCurrency(monthlyStatement.net)}
          />
        </dl>
        {anchor && (
          <p
            role="status"
            className="mt-5 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground"
          >
            {t(
              statementIssue === 'before_indicator_anchor'
                ? 'settings.before_anchor'
                : 'settings.active_anchor',
              { date: anchor.start_date },
            )}
            {statementIssue !== 'before_indicator_anchor' &&
              monthKey === anchor.start_date.slice(0, 7) &&
              anchor.start_date.slice(8) !== '01' &&
              ` ${t('settings.partial_month')}`}
          </p>
        )}
      </div>
    </header>
  );
}
