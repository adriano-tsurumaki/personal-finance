import { useFinancialOperations } from '@store/financial-operations';
import { useMonthlyStatementFeedback } from './use-monthly-statement-feedback';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import BalanceSparkline from './BalanceSparkline';
import OdometerMoney from '@components/OdometerMoney';
import {
  formatCompactCurrency,
  formatYearMonthToString,
} from '@lib/format/currency';

import { useAppStore } from '@store/transaction';
import { shiftMonth } from '@shared/lib/calc';
import ProfileHeader from '@modules/Profiles/ProfileHeader';
import { t } from '@lib/i18n';

function formatSavingsRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function MonthlyFinance(): React.JSX.Element {
  const monthlyStatement = useAppStore((s) => s.monthlyStatement);
  const monthKey = useAppStore((s) => s.monthKey);
  const setMonthKey = useAppStore((s) => s.setMonthKey);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const loaded = useAppStore((s) => s.statementLoaded);
  const statementLoading = useAppStore((s) => s.statementLoading);

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

          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {formatYearMonthToString(year, month)}
            </h1>
          </div>

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
          className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">
              {t('summary.balance')}
            </p>
            <div className="relative" aria-busy={statementLoading}>
              <p className="font-mono text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
                {loaded ? (
                  <OdometerMoney value={monthlyStatement.closingBalance} />
                ) : (
                  '—'
                )}
              </p>
            </div>
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

          <div
            className="w-full max-w-60 shrink-0"
            style={{
              visibility:
                loaded && monthlyStatement.balanceSeries.length >= 2
                  ? 'visible'
                  : 'hidden',
            }}
          >
            <BalanceSparkline data={monthlyStatement.balanceSeries} />
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            available={loaded}
            label={t('summary.income')}
            value={monthlyStatement.income}
            tone="income"
            icon={<ArrowUpRight className="size-4" aria-hidden="true" />}
          />
          <Stat
            available={loaded}
            label={t('summary.expenses')}
            value={monthlyStatement.expense}
            tone="expense"
            icon={<ArrowDownRight className="size-4" aria-hidden="true" />}
          />
          <Stat
            available={loaded}
            label={t('summary.saved')}
            value={monthlyStatement.savingsRate}
            formatValue={formatSavingsRate}
            tone="neutral"
            hint={formatCompactCurrency(monthlyStatement.net)}
          />
        </dl>
      </div>
    </header>
  );
}

function Stat({
  label,
  available,
  value,
  formatValue,
  tone,
  icon,
  hint,
}: {
  label: string;
  available: boolean;
  value: number;
  formatValue?: (value: number) => string;
  tone: 'income' | 'expense' | 'neutral';
  icon?: React.ReactNode;
  hint?: string;
}): React.JSX.Element {
  const toneClass =
    tone === 'income'
      ? 'text-income'
      : tone === 'expense'
        ? 'text-expense'
        : 'text-foreground';

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd
        className={`relative mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}
      >
        <span>
          {available ? (
            <OdometerMoney value={value} formatValue={formatValue} />
          ) : (
            '—'
          )}
          {available && hint ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {t('summary.net', { amount: hint })}
            </span>
          ) : null}
        </span>
      </dd>
    </div>
  );
}
