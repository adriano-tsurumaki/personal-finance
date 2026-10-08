import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import BalanceSparkline from './BalanceSparkline';
import OdometerMoney from '@components/OdometerMoney';
import {
  formatCompactCurrency,
  formatYearMonthToString,
} from '@lib/format/currency';

import { useAppStore } from '@store/transaction';
import { shiftMonth } from '@shared/lib/calc';
import { t } from '@lib/i18n';

export default function MonthlyFinance(): React.JSX.Element {
  const monthlyStatement = useAppStore((s) => s.monthlyStatement);
  const monthKey = useAppStore((s) => s.monthKey);
  const setMonthKey = useAppStore((s) => s.setMonthKey);

  const [year, month] = monthKey.split('-').map(Number);
  const summaryAvailable = typeof window.api.getMonthlyStatement === 'function';

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-3xl px-5 pb-8 pt-10 sm:px-8">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Wallet className="size-4" aria-hidden="true" />
          <span>Ledger</span>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
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
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            aria-label={t('summary.next')}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('summary.balance')}
            </p>
            {summaryAvailable && (
              <p className="font-mono text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
                <OdometerMoney value={monthlyStatement.closingBalance} />
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {t('summary.pending')}
            </p>
          </div>

          {monthlyStatement.balanceSeries.length >= 2 ? (
            <div className="w-full max-w-60 shrink-0">
              <BalanceSparkline data={monthlyStatement.balanceSeries} />
              <p className="mt-2 text-right text-xs text-muted-foreground">
                {t('summary.balance')}
              </p>
            </div>
          ) : null}
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label={t('summary.income')}
            value={
              summaryAvailable
                ? formatCompactCurrency(monthlyStatement.income)
                : '—'
            }
            tone="income"
            icon={<ArrowUpRight className="size-4" aria-hidden="true" />}
          />
          <Stat
            label={t('summary.expenses')}
            value={
              summaryAvailable
                ? formatCompactCurrency(monthlyStatement.expense)
                : '—'
            }
            tone="expense"
            icon={<ArrowDownRight className="size-4" aria-hidden="true" />}
          />
          <Stat
            label={t('summary.saved')}
            value={
              summaryAvailable
                ? `${Math.round(monthlyStatement.savingsRate * 100)}%`
                : '—'
            }
            tone="neutral"
            hint={
              summaryAvailable
                ? formatCompactCurrency(monthlyStatement.net)
                : undefined
            }
          />
        </dl>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: string;
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
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}
      >
        {/* <OdometerMoney value={value} /> */}
        {value}
        {hint ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {t('summary.net', { amount: hint })}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
