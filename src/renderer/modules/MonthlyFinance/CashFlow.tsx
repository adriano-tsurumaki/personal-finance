import { FieldSelect } from '@components/ui/field';
import {
  ArrowDownRight,
  ArrowUpRight,
  ReceiptText,
  Repeat,
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';
import { cardDate } from '@lib/card-corrections';
import { formatCurrency, formatSignedCurrency } from '@lib/format/currency';
import BalanceSparkline from './BalanceSparkline';
import { referenceChart } from './reference-chart';

export default function CashFlow({
  initialBasis = 'cash_flow',
}: { initialBasis?: 'cash_flow' | 'reference' } = {}) {
  const [basis, setBasis] = useState(initialBasis);
  const statement = useAppStore((s) => s.monthlyStatement);
  const statementLoaded = useAppStore((s) => s.statementLoaded);
  const statementLoading = useAppStore((s) => s.statementLoading);
  const transactions = useAppStore((s) => s.transactions);
  const recurrence = useAppStore((s) => s.recurrenceMonth);
  const monthKey = useAppStore((s) => s.monthKey);
  const transactionsLoading = useAppStore((s) => s.transactionsLoading);
  const transactionsFailed = useAppStore((s) => s.transactionsFailed);
  const issue = useAppStore((s) => s.statementIssue);
  const reference = referenceChart(
    monthKey,
    transactions,
    recurrence?.occurrences ?? [],
  );
  const byReference = basis === 'reference';
  const loaded = byReference
    ? !transactionsLoading && !transactionsFailed && reference.summary !== null
    : statementLoaded;
  const loading = byReference ? transactionsLoading : statementLoading;
  const events = byReference
    ? reference.events
    : (statement.cashFlowEvents ?? []);
  const series = byReference
    ? reference.balanceSeries
    : statement.balanceSeries;
  const closing = byReference
    ? (reference.summary?.net ?? 0)
    : statement.closingBalance;

  return (
    <section
      aria-busy={loading}
      className="mx-auto max-w-3xl px-5 py-8 sm:px-8"
    >
      <h2 className="text-sm font-semibold">{t('monthly_views.cash_flow')}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t(
          byReference
            ? 'monthly_views.reference_chart_hint'
            : 'monthly_views.cash_flow_hint',
        )}
      </p>
      <div className="my-5 max-w-sm">
        {/* Both views use the confirmed snapshot; this local choice needs no financial lock. */}
        <FieldSelect
          label={t('monthly_views.chart_basis')}
          options={[
            { value: 'cash_flow', label: t('monthly_views.cash_flow_option') },
            { value: 'reference', label: t('monthly_views.reference_option') },
          ]}
          value={basis}
          onValueChange={(value) => {
            if (value === 'cash_flow' || value === 'reference') {
              setBasis(value);
            }
          }}
        />
      </div>
      {!loaded ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground"
        >
          {t(
            loading
              ? 'common.loading'
              : !byReference && issue === 'before_indicator_anchor'
                ? 'monthly_views.outside_period'
                : 'monthly_views.unavailable',
          )}
        </p>
      ) : (
        <>
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t(
                  byReference
                    ? 'monthly_views.reference_chart_title'
                    : 'summary.chart',
                )}
              </h3>
              <span className="font-mono text-sm tabular-nums">
                {formatCurrency(closing)}
              </span>
            </div>
            {series.length >= 2 ? (
              <div className="[&_svg]:h-36">
                <BalanceSparkline
                  data={series}
                  label={t(
                    byReference
                      ? 'monthly_views.reference_chart_title'
                      : 'summary.chart',
                  )}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('monthly_views.single_day')}
              </p>
            )}
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>{series[0] && cardDate(series[0].date)}</span>
              <span>{series.at(-1) && cardDate(series.at(-1)!.date)}</span>
            </div>
          </div>
          <h3 className="mb-3 text-sm font-semibold">
            {t(
              byReference
                ? 'monthly_views.reference_movements'
                : 'monthly_views.movements',
            )}
          </h3>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              {t(
                byReference
                  ? 'monthly_views.reference_empty'
                  : 'monthly_views.empty',
              )}
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {events.map((event) => {
                const Icon =
                  event.kind === 'recurrence'
                    ? Repeat
                    : event.kind.startsWith('invoice')
                      ? ReceiptText
                      : event.income
                        ? ArrowUpRight
                        : ArrowDownRight;
                return (
                  <li key={event.id} className="flex items-start gap-3 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                      <Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        {event.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <time dateTime={event.date}>
                          {cardDate(event.date)}
                        </time>{' '}
                        ·{' '}
                        {t(
                          byReference && event.kind === 'recurrence'
                            ? 'monthly_views.recurrence_reference'
                            : `monthly_views.${event.kind}`,
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${event.income ? 'text-income' : 'text-expense'}`}
                    >
                      {formatSignedCurrency(
                        event.income || event.expense,
                        event.income ? 'income' : 'expense',
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
