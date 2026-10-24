import { useEffect, useRef, useState } from 'react';
import {
  Repeat,
  Plus,
  ArrowUp,
  ArrowDown,
  Equal,
  Info,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import ScreenHeader from '@components/ScreenHeader';
import { ScreenFilters, ScreenSearch } from '@components/ScreenToolbar';
import { toast } from '@components/ui/toast';
import { t, getLocale } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type {
  RecurrenceRuleDto,
  RecurrenceOccurrenceDto,
  RecurrenceResult,
} from '@shared/contracts/recurrence';
import type { CreditCardDto } from '@shared/contracts/credit-cards';
import { performRecurrenceMutation } from './mutation';
import { localToday, forecastEnd, monthlyEquivalent } from './presentation';

import RuleCard from './RuleCard';
import { OccurrenceSummary, occurrenceDate } from './OccurrenceSummary';
import { RecurrenceEditor, type Editor } from './RecurrenceEditor';
import {
  filterOccurrences,
  filterRules,
  type RecurrenceFilter,
} from './presentation';
import MonthNavigator from '@components/MonthNavigator';
import { useMonthlyStatementFeedback } from '@modules/MonthlyFinance/use-monthly-statement-feedback';
export { OccurrenceSummary } from './OccurrenceSummary';
export { RecurrenceEditor } from './RecurrenceEditor';

export default function Recurrences() {
  useMonthlyStatementFeedback();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecurrenceFilter>('all');
  const month = useAppStore((state) => state.monthKey);
  const period = useAppStore((state) => state.recurrenceMonth);
  const session = useProfileStore((state) => state.sessionVersion);
  const [tab, setTab] = useState('month');
  const [rules, setRules] = useState<RecurrenceRuleDto[]>([]);
  const [forecast, setForecast] = useState<RecurrenceOccurrenceDto[]>([]);
  const [cards, setCards] = useState<CreditCardDto[]>([]);
  const [today, setToday] = useState(localToday);
  const previousToday = useRef(today);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const mounted = useRef(false);
  const request = useRef(0);
  const owner = useRef<symbol | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const notice = useRef<string | undefined>(undefined);
  const current = () =>
    mounted.current && session === useProfileStore.getState().sessionVersion;
  async function load() {
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const forecastStart = localToday();
      const [all, upcoming, cardRows] = await Promise.all([
        window.api.recurrence.list(),
        window.api.recurrence.forecast(
          forecastStart,
          forecastEnd(forecastStart),
        ),
        window.api.getCreditCards(),
      ]);

      if (current() && id === request.current) {
        setRules(all);
        setForecast(upcoming.filter((entry) => entry.state === 'unconfirmed'));
        setCards(cardRows);
        return true;
      }
    } catch {
      if (current() && id === request.current) {
        setFailed(true);
      }

      return false;
    } finally {
      if (current() && id === request.current) {
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    setEditor(null);
    owner.current = null;
    setBusy(false);
    setRules([]);
    setForecast([]);
    const release = useFinancialOperations.getState().begin('period');
    void load().finally(release);
    return () => {
      mounted.current = false;
      request.current++;

      if (notice.current) {
        toast.close(notice.current);
      }
    };
  }, [session]);
  useEffect(() => {
    if (previousToday.current === today) {
      return;
    }

    previousToday.current = today;
    const release = useFinancialOperations.getState().begin('period');
    void load().finally(release);
  }, [today]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localToday()), 30_000);
    const update = () => setToday(localToday());
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  function open(next: Editor) {
    if (financialActionsBlocked()) {
      return;
    }

    returnFocus.current = document.activeElement as HTMLElement;

    if (next.action === 'create') {
      setTab('all');
    }

    setEditor(next);
  }
  async function mutate(operation: () => Promise<RecurrenceResult<unknown>>) {
    if (owner.current || financialActionsBlocked()) {
      return;
    }

    const token = Symbol('recurrence-mutation');
    owner.current = token;
    setBusy(true);
    try {
      const outcome = await performRecurrenceMutation({
        current,
        persist: operation,
        onSaved: () => {
          setEditor(null);
          returnFocus.current?.focus();
        },
        refresh: async () => {
          const [loaded] = await Promise.all([
            load(),
            useAppStore.getState().refreshMonth(),
          ]);
          return (
            !!loaded &&
            !useAppStore.getState().statementFailed &&
            !useAppStore.getState().failedMonth
          );
        },
      });

      if (
        current() &&
        (outcome.status === 'error' || outcome.status === 'refresh_failed')
      ) {
        const saved = outcome.status === 'refresh_failed';
        const code = outcome.code;
        const errorKey =
          code === 'invalid_input' ||
          code === 'conflict' ||
          code === 'not_found'
            ? code
            : code === 'repair_required'
              ? 'repair_required_error'
              : 'save_error';

        if (notice.current) {
          toast.close(notice.current);
        }

        notice.current = toast.add({
          title: t(
            saved ? 'recurrence.saved_refresh_error' : 'common.error_title',
          ),
          description: t(
            saved ? 'recurrence.retry_refresh' : `recurrence.${errorKey}`,
          ),
          type: 'error',
        });
      }
    } finally {
      if (owner.current === token) {
        owner.current = null;
      }

      if (current()) {
        setBusy(false);
      }
    }
  }

  const totals = rules.reduce(
    (sum, rule) => {
      const version = rule.versions.at(-1);
      sum[version?.type === 1 ? 0 : 1] += monthlyEquivalent(rule);
      return sum;
    },
    [0, 0],
  );
  const visibleOccurrences = filterOccurrences(
    period?.occurrences ?? [],
    query,
    filter,
  );
  const visibleRules = filterRules(
    rules,
    query,
    filter,
    period?.occurrences ?? [],
  );
  return (
    <section
      aria-labelledby="recurrences-title"
      className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"
    >
      <ScreenHeader
        id="recurrences-title"
        title={t('sections.recurring')}
        description={t('recurrence.equivalents_hint')}
        icon={Repeat}
        actions={
          <Button disabled={blocked} onClick={() => open({ action: 'create' })}>
            <Plus aria-hidden="true" />
            {t('recurrence.add')}
          </Button>
        }
      />
      <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['income', 'expense', 'net'] as const).map((key, index) => (
          <div
            key={key}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${index === 0 ? 'text-income' : index === 1 ? 'text-expense' : 'text-primary'}`}
            >
              {index === 0 ? (
                <ArrowUp aria-hidden="true" />
              ) : index === 1 ? (
                <ArrowDown aria-hidden="true" />
              ) : (
                <Equal aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                {t(`recurrence.${key}`)}
              </dt>
              <dd
                className={`mt-1 font-mono text-xl font-semibold tabular-nums ${index === 1 || (index === 2 && totals[0] < totals[1]) ? 'text-expense' : 'text-income'}`}
              >
                {loading || failed
                  ? '—'
                  : formatCurrency(
                      (index === 2 ? totals[0] - totals[1] : totals[index]) /
                        100,
                    )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {editor && (
        <RecurrenceEditor
          key={
            editor.action +
            ('rule' in editor
              ? editor.rule.id
              : 'occurrence' in editor
                ? `${editor.occurrence.recurrence_id}:${editor.occurrence.scheduled_date}`
                : '')
          }
          editor={editor}
          cards={cards}
          busy={busy}
          returnFocus={returnFocus.current}
          onClose={() => {
            setEditor(null);
            returnFocus.current?.focus();
          }}
          onInstallmentSaved={async () => {
            const [loaded] = await Promise.all([
              load(),
              useAppStore.getState().refreshMonth(),
            ]);

            if (
              current() &&
              (!loaded ||
                useAppStore.getState().statementFailed ||
                useAppStore.getState().failedMonth)
            ) {
              throw new Error('refresh_failed');
            }
          }}
          onSave={mutate}
        />
      )}
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
          <TabsList aria-label={t('sections.recurring')} activateOnFocus>
            <TabsTrigger value="month">
              {t('recurrence.in_month')} · {month}
            </TabsTrigger>
            <TabsTrigger value="all">{t('recurrence.all')}</TabsTrigger>
          </TabsList>
          <MonthNavigator
            month={month}
            disabled={blocked}
            onChange={(next) => {
              if (!financialActionsBlocked()) {
                void useAppStore.getState().setMonthKey(next);
              }
            }}
          />
          <ScreenSearch
            label={t('recurrence.search')}
            value={query}
            onValueChange={setQuery}
          />
          <ScreenFilters
            label={t('recurrence.filters')}
            value={filter}
            items={(['all', 'income', 'expense', 'pending'] as const).map(
              (value) => ({
                value,
                label: t(`recurrence.filter_${value}`),
              }),
            )}
            onValueChange={setFilter}
          />
        </div>
        {loading ? (
          <p role="status" className="py-6 text-sm">
            {t('common.loading')}
          </p>
        ) : failed ? (
          <div role="alert" className="py-6">
            <p>{t('common.error')}</p>
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() => {
                if (!financialActionsBlocked()) {
                  const release = useFinancialOperations
                    .getState()
                    .begin('period');
                  void load().finally(release);
                }
              }}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
            <div className="min-w-0">
              <TabsContent value="month">
                {!period ? (
                  <div role="alert">
                    <p>{t('common.error')}</p>
                    <Button
                      variant="outline"
                      disabled={blocked}
                      onClick={() => {
                        if (!financialActionsBlocked()) {
                          void useAppStore.getState().refreshMonth();
                        }
                      }}
                    >
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                      <Info
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {t('recurrence.period_count', {
                        count: period.unconfirmed_count,
                        month,
                      })}
                    </p>
                    {visibleOccurrences.length === 0 && (
                      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        {t(
                          query || filter !== 'all'
                            ? 'recurrence.no_results'
                            : 'recurrence.empty_month',
                        )}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {visibleOccurrences.map((occurrence) => (
                        <li
                          key={`${occurrence.recurrence_id}:${occurrence.scheduled_date}`}
                          className={`rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-within:border-ring ${occurrence.state === 'unconfirmed' ? 'border-primary/30' : 'border-border'}`}
                        >
                          <OccurrenceSummary occurrence={occurrence} />
                          <div className="mt-3 flex flex-wrap gap-2 empty:hidden sm:pl-13">
                            {occurrence.state === 'unconfirmed' && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={blocked}
                                  onClick={() =>
                                    open({ action: 'confirm', occurrence })
                                  }
                                >
                                  {t('recurrence.confirm')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={blocked}
                                  onClick={() =>
                                    void mutate(() =>
                                      window.api.recurrence.ignore(occurrence),
                                    )
                                  }
                                >
                                  {t('recurrence.ignore')}
                                </Button>
                              </>
                            )}
                            {occurrence.state === 'ignored' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={blocked}
                                onClick={() =>
                                  void mutate(() =>
                                    window.api.recurrence.restore(occurrence),
                                  )
                                }
                              >
                                {t('recurrence.restore')}
                              </Button>
                            )}
                            {occurrence.state === 'unconfirmed' &&
                              occurrence.coverage !== 'not_required' &&
                              occurrence.credit_card_invoice_id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={blocked}
                                    onClick={() =>
                                      void mutate(() =>
                                        window.api.recurrence.coverage({
                                          ...occurrence,
                                          credit_card_invoice_id:
                                            occurrence.credit_card_invoice_id!,
                                          status: 'included',
                                        }),
                                      )
                                    }
                                  >
                                    {t('recurrence.included')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={blocked}
                                    onClick={() =>
                                      void mutate(() =>
                                        window.api.recurrence.coverage({
                                          ...occurrence,
                                          credit_card_invoice_id:
                                            occurrence.credit_card_invoice_id!,
                                          status: 'excluded',
                                        }),
                                      )
                                    }
                                  >
                                    {t('recurrence.excluded')}
                                  </Button>
                                </>
                              )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </TabsContent>
              <TabsContent value="all">
                {visibleRules.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    {t(
                      query || filter !== 'all'
                        ? 'recurrence.no_results'
                        : 'recurrence.empty_rules',
                    )}
                  </p>
                )}
                {([1, 2] as const).map((type) => {
                  const group = visibleRules.filter(
                    (rule) => (rule.versions.at(-1)?.type ?? 2) === type,
                  );
                  return (
                    group.length > 0 && (
                      <div key={type} className="mb-6">
                        <h3 className="mb-3 text-xs font-medium text-muted-foreground">
                          {t(
                            type === 1
                              ? 'transactions.income'
                              : 'transactions.expense',
                          )}
                        </h3>
                        <ul className="space-y-2">
                          {group.map((rule) => (
                            <RuleCard
                              key={rule.id}
                              rule={rule}
                              blocked={blocked}
                              onEdit={(action) => open({ action, rule })}
                              onDismiss={() =>
                                void mutate(() =>
                                  window.api.recurrence.dismissLegacy(rule.id),
                                )
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    )
                  );
                })}
              </TabsContent>
            </div>
            <aside className="self-start rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays
                  className="size-5 text-primary"
                  aria-hidden="true"
                />
                {t('recurrence.forecast')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('recurrence.today_anchor', { date: occurrenceDate(today) })}
              </p>
              {forecast.length === 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t('recurrence.empty_forecast')}
                </p>
              )}
              <ol className="mt-4 divide-y divide-border">
                {forecast
                  .filter((row) => row.state === 'unconfirmed')
                  .map((row) => (
                    <li
                      key={`${row.recurrence_id}:${row.scheduled_date}`}
                      className="flex items-center gap-3 py-3"
                    >
                      <time
                        dateTime={row.scheduled_date}
                        className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-muted/40 py-1 text-xs"
                      >
                        <span>
                          {new Date(
                            `${row.scheduled_date}T12:00:00`,
                          ).toLocaleDateString(getLocale(), { month: 'short' })}
                        </span>
                        <span className="text-base font-semibold">
                          {Number(row.scheduled_date.slice(8))}
                        </span>
                      </time>
                      <div className="min-w-0 flex-1">
                        <OccurrenceSummary occurrence={row} compact />
                      </div>
                    </li>
                  ))}
              </ol>
            </aside>
          </div>
        )}
      </Tabs>
    </section>
  );
}
