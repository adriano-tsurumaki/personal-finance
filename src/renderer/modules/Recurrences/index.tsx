import CreditFinancingFields, {
  emptyFinancing,
} from '@components/CreditFinancingFields';
import PlanDialog from '@modules/Installments/PlanDialog';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';
import {
  invoiceSelection,
  installmentInvoiceSelection,
} from './invoice-selection';
import { isCreditPayment, isFinancedPayment } from '@shared/lib/payment-method';
import { useEffect, useRef, useState } from 'react';
import { Repeat, Plus } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Field, FieldLabel } from '@components/ui/field';
import { Input } from '@components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { toast } from '@components/ui/toast';
import { t, getLocale } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { confirmCardCorrection } from '@lib/card-corrections';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type {
  RecurrenceBoundaryPreviewDto,
  RecurrenceDefaults,
  RecurrenceRuleDto,
  RecurrenceOccurrenceDto,
  RecurrenceResult,
} from '@shared/contracts/recurrence';
import type {
  CreditCardDto,
  InvoiceDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import DefaultFields, { type DefaultValues } from './DefaultFields';
import { validateDefaults } from './validation';
import { performRecurrenceMutation } from './mutation';
import { localToday, forecastEnd, monthlyEquivalent } from './presentation';

type Editor =
  | { action: 'create' }
  | { action: 'edit' | 'pause' | 'end' | 'resume'; rule: RecurrenceRuleDto }
  | { action: 'confirm'; occurrence: RecurrenceOccurrenceDto };
const blank: RecurrenceDefaults = {
  name: '',
  type: 2,
  amount_cents: 0,
  category_id: null,
  payment_id: 0,
  credit_card_id: null,
};
export function occurrenceDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(getLocale());
}

export default function Recurrences() {
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
  const paused = period?.paused_rules ?? [];
  function ruleRows(rows: RecurrenceRuleDto[]) {
    return (
      <ul className="space-y-2">
        {rows.map((rule) => {
          const version = rule.versions.at(-1);
          return (
            <li
              key={rule.id}
              className={`rounded-lg border border-border bg-card p-4 ${rule.status === 'paused' ? 'opacity-55' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Repeat
                  className="mt-1 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`recurrence.${rule.status}`)} ·{' '}
                    {rule.anchor_date && occurrenceDate(rule.anchor_date)}
                    {rule.last_retained_date &&
                      ` · ${t('recurrence.last_retained')}: ${occurrenceDate(rule.last_retained_date)}`}
                  </p>
                  {version && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`recurrence.frequency_${version.frequency}`)} ×{' '}
                      {version.interval} · {t('recurrence.estimate')}:{' '}
                      {formatCurrency(monthlyEquivalent(rule) / 100)}
                    </p>
                  )}
                </div>
                <span
                  className={`font-mono text-sm ${version?.type === 1 ? 'text-income' : 'text-expense'}`}
                >
                  {version && formatCurrency(version.amount_cents / 100)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {rule.status === 'active' && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={blocked}
                      onClick={() => open({ action: 'edit', rule })}
                    >
                      {t('recurrence.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={blocked}
                      onClick={() => open({ action: 'pause', rule })}
                    >
                      {t('recurrence.pause')}
                    </Button>
                  </>
                )}
                {rule.status === 'paused' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => open({ action: 'resume', rule })}
                  >
                    {t('recurrence.resume')}
                  </Button>
                )}
                {rule.status === 'repair_required' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blocked}
                    onClick={() =>
                      void mutate(() =>
                        window.api.recurrence.dismissLegacy(rule.id),
                      )
                    }
                  >
                    {t('recurrence.dismiss_legacy')}
                  </Button>
                )}
                {(rule.status === 'active' || rule.status === 'paused') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={blocked}
                    onClick={() => open({ action: 'end', rule })}
                  >
                    {t('recurrence.end')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Repeat className="size-4" aria-hidden="true" />
          {t('sections.recurring')}
        </h2>
        <Button disabled={blocked} onClick={() => open({ action: 'create' })}>
          <Plus aria-hidden="true" />
          {t('recurrence.add')}
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {t('recurrence.equivalents_hint')}
      </p>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(['income', 'expense', 'net'] as const).map((key, index) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-card p-3"
          >
            <dt className="text-xs text-muted-foreground">
              {t(`recurrence.${key}`)}
            </dt>
            <dd
              className={`mt-2 font-mono text-sm ${index === 1 ? 'text-expense' : 'text-income'}`}
            >
              {loading || failed
                ? '—'
                : formatCurrency(
                    (index === 2 ? totals[0] - totals[1] : totals[index]) / 100,
                  )}
            </dd>
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
        <TabsList aria-label={t('sections.recurring')} activateOnFocus>
          <TabsTrigger value="month">
            {t('recurrence.in_month')} · {month}
          </TabsTrigger>
          <TabsTrigger value="all">{t('recurrence.all')}</TabsTrigger>
        </TabsList>
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
          <div className="grid gap-6 pt-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div>
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
                    <p className="mb-3 text-xs text-muted-foreground">
                      {t('recurrence.period_count', {
                        count: period.unconfirmed_count,
                        month,
                      })}
                    </p>
                    {period.occurrences.length === 0 && (
                      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        {t('recurrence.empty_month')}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {period.occurrences.map((occurrence) => (
                        <li
                          key={`${occurrence.recurrence_id}:${occurrence.scheduled_date}`}
                          className="rounded-lg border border-border bg-card p-4"
                        >
                          <OccurrenceSummary occurrence={occurrence} />
                          <div className="mt-3 flex flex-wrap gap-2">
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
                    {paused.length > 0 && (
                      <div className="mt-6">
                        <h3 className="mb-3 text-xs font-medium text-muted-foreground">
                          {t('recurrence.paused')}
                        </h3>
                        {ruleRows(paused)}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="all">
                {rules.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    {t('recurrence.empty_rules')}
                  </p>
                )}
                {([1, 2] as const).map((type) => {
                  const group = rules.filter(
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
                        {ruleRows(group)}
                      </div>
                    )
                  );
                })}
              </TabsContent>
            </div>
            <aside className="self-start rounded-lg border border-border bg-card p-4 md:sticky md:top-4">
              <h3 className="text-xs font-medium">
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
              <ol className="mt-4 space-y-4">
                {forecast
                  .filter((row) => row.state === 'unconfirmed')
                  .map((row) => (
                    <li key={`${row.recurrence_id}:${row.scheduled_date}`}>
                      <OccurrenceSummary occurrence={row} compact />
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

export function OccurrenceSummary({
  occurrence: row,
  compact = false,
}: {
  occurrence: RecurrenceOccurrenceDto;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{row.name}</p>
        <span
          className={`shrink-0 font-mono text-xs ${row.type === 1 ? 'text-income' : 'text-expense'}`}
        >
          {formatCurrency(row.amount_cents / 100)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <time dateTime={row.scheduled_date}>
          {occurrenceDate(row.scheduled_date)}
        </time>{' '}
        · <Repeat className="inline size-3" aria-hidden="true" />{' '}
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
    </>
  );
}

export function RecurrenceEditor({
  editor,
  cards,
  busy,
  onClose,
  onSave,
  onInstallmentSaved,
  returnFocus,
}: {
  editor: Editor;
  cards: CreditCardDto[];
  busy: boolean;
  returnFocus: HTMLElement | null;
  onClose: () => void;
  onInstallmentSaved?: () => Promise<void>;
  onSave: (
    operation: () => Promise<RecurrenceResult<unknown>>,
  ) => Promise<void>;
}) {
  const version = 'rule' in editor ? editor.rule.versions.at(-1) : null;
  const occurrence = 'occurrence' in editor ? editor.occurrence : null;
  const [split, setSplit] = useState(false);
  const [financing, setFinancing] = useState<CreditFinancingInput | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof DefaultValues, string>>
  >({});
  const [values, setValues] = useState<RecurrenceDefaults>(
    occurrence ??
      (version
        ? {
            ...version,
            type: version.type ?? 2,
            payment_id: version.payment_id ?? 0,
          }
        : blank),
  );
  const [date, setDate] = useState(
    occurrence?.scheduled_date ??
      ('rule' in editor
        ? (editor.rule.last_retained_date ?? version?.start_date)
        : null) ??
      localToday(),
  );
  const [boundaryPreview, setBoundaryPreview] =
    useState<RecurrenceBoundaryPreviewDto | null>(null);
  const [boundaryFailed, setBoundaryFailed] = useState(false);
  const [cadence, setCadence] = useState('monthly');
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suggestion, setSuggestion] = useState<InvoicePeriodDto | null>(null);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<string | null>(null);
  const [billingFailed, setBillingFailed] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const session = useProfileStore((state) => state.sessionVersion);
  const profile = useProfileStore((state) => state.activeProfile);
  const options = useProfileStore((state) => state.options);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const credit = isCreditPayment(
    options.payments.find((row) => row.id === values.payment_id)?.catalog_key,
  );
  const financed = isFinancedPayment(
    options.payments.find((row) => row.id === values.payment_id)?.catalog_key,
  );
  const defaultsForm = ['create', 'edit', 'confirm'].includes(editor.action);
  useEffect(() => {
    let active = true;
    setInvoices([]);
    setSuggestion(null);
    setBillingFailed(false);

    if (editor.action === 'confirm' && credit && values.credit_card_id) {
      setBillingLoading(true);
      void Promise.all([
        window.api.getCardInvoices(values.credit_card_id),
        invoiceMonth
          ? window.api.previewInvoicePeriod(values.credit_card_id, invoiceMonth)
          : window.api.suggestInvoicePeriod(values.credit_card_id, date),
      ])
        .then(([rows, period]) => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setInvoices(rows);
            setSuggestion(period);
          }
        })
        .catch(() => {
          if (active) {
            setBillingFailed(true);
          }
        })
        .finally(() => {
          if (active) {
            setBillingLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [
    editor.action,
    credit,
    values.credit_card_id,
    date,
    session,
    invoiceMonth,
  ]);
  useEffect(() => {
    let active = true;
    setBoundaryPreview(null);
    setBoundaryFailed(false);

    if ((editor.action === 'pause' || editor.action === 'end') && date) {
      void window.api.recurrence
        .previewBoundary({
          recurrence_id: editor.rule.id,
          last_retained_date: date,
        })
        .then((preview) => {
          if (active && session === useProfileStore.getState().sessionVersion) {
            setBoundaryPreview(preview);
          }
        })
        .catch(() => {
          if (active) {
            setBoundaryFailed(true);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [editor, date, session]);
  useEffect(() => {
    setInvoiceId(null);
  }, [values.credit_card_id, date]);
  const selectedInvoice = invoices.find((row) => row.id === invoiceId);
  const dueDate = invoiceId
    ? (selectedInvoice?.paid_at ?? selectedInvoice?.due_date)
    : suggestion?.due_date;
  const form = (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (financialActionsBlocked()) {
          return;
        }

        const invalid = defaultsForm
          ? validateDefaults(values, options, cards)
          : {};
        setErrors(
          Object.fromEntries(
            Object.entries(invalid).map(([field, key]) => [field, t(key)]),
          ),
        );

        if (Object.keys(invalid).length > 0) {
          return;
        }

        void onSave(async () => {
          if (editor.action === 'create') {
            return window.api.recurrence.create({
              ...values,
              start_date: date,
              frequency:
                cadence === 'weekly' ? 2 : cadence === 'yearly' ? 4 : 3,
              interval: cadence === 'quarterly' ? 3 : 1,
            });
          }

          if (editor.action === 'edit') {
            return window.api.recurrence.update({
              ...values,
              recurrence_id: editor.rule.id,
              scheduled_date: date,
              expected_version_id:
                editor.rule.versions.find(
                  (entry) =>
                    entry.start_date <= date &&
                    (!entry.end_date || date < entry.end_date),
                )?.id ?? version!.id,
            });
          }

          if (editor.action === 'pause' || editor.action === 'end') {
            return window.api.recurrence.boundary({
              recurrence_id: editor.rule.id,
              last_retained_date: date,
              action: editor.action,
            });
          }

          if (editor.action === 'resume') {
            return window.api.recurrence.resume({
              recurrence_id: editor.rule.id,
              first_date: date,
            });
          }

          if (!occurrence || !profile) {
            throw new Error('No active occurrence.');
          }

          const input = {
            ...values,
            recurrence_id: occurrence.recurrence_id,
            scheduled_date: occurrence.scheduled_date,
            expected_version_id: occurrence.version_id,
            reference_date: date,
            ...invoiceSelection(credit, invoiceMonth, invoiceId),
            financing: financed
              ? (financing ?? emptyFinancing(values.amount_cents))
              : null,
          };
          let correction_token: string | undefined;

          if (credit) {
            const plan = await window.api.previewTransactionCreation({
              ...values,
              financing: input.financing,
              invoice_month: invoiceMonth,
              card_id: values.credit_card_id,
              user_id: profile.id,
              reference_date: date,
              payment_date: null,
              credit_card_invoice_id: invoiceId,
            });

            if (
              session !== useProfileStore.getState().sessionVersion ||
              !plan ||
              !(await confirmCardCorrection(plan)) ||
              session !== useProfileStore.getState().sessionVersion
            ) {
              return {
                ok: false,
                error: { code: 'conflict', message: 'Cancelled' },
              };
            }

            correction_token = plan.token;
          }

          return window.api.recurrence.confirm({
            ...input,
            correction_token,
          });
        });
      }}
    >
      {defaultsForm && (
        <DefaultFields
          value={values}
          onChange={(next) => {
            if (next.payment_id !== values.payment_id) {
              setFinancing(null);
              const selection = invoiceSelection(
                isCreditPayment(
                  options.payments.find((row) => row.id === next.payment_id)
                    ?.catalog_key,
                ),
                invoiceMonth,
                invoiceId,
              );
              setInvoiceMonth(selection.invoice_month);
              setInvoiceId(selection.credit_card_invoice_id);
              next.amount_cents =
                financing?.principal_cents ?? next.amount_cents;
            } else if (financing && next.amount_cents !== values.amount_cents) {
              setFinancing(null);
            }

            setValues(next);
          }}
          cards={cards}
          amountReadOnly={editor.action === 'confirm' && financed}
          fixedType={editor.action !== 'create'}
          errors={errors}
        />
      )}
      {editor.action === 'create' && (
        <Field>
          <FieldLabel htmlFor="recurrence-cadence">
            {t('recurrence.frequency')}
          </FieldLabel>
          <Select
            value={cadence}
            items={(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(
              (value) => ({ value, label: t(`recurrence.${value}`) }),
            )}
            onValueChange={(value) => setCadence(String(value))}
          >
            <SelectTrigger id="recurrence-cadence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {t(`recurrence.${value}`)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="recurrence-date">
          {t(
            editor.action === 'confirm'
              ? 'transactions.date'
              : editor.action === 'pause' || editor.action === 'end'
                ? 'recurrence.last_retained'
                : editor.action === 'edit'
                  ? 'recurrence.effective_date'
                  : 'recurrence.first_date',
          )}
        </FieldLabel>
        <Input
          id="recurrence-date"
          required
          type="date"
          value={date}
          onInput={(event) => setDate(event.currentTarget.value)}
          onChange={(event) => setDate(event.currentTarget.value)}
        />
      </Field>
      {(editor.action === 'pause' || editor.action === 'end') && (
        <p className="text-xs text-muted-foreground">
          {t('recurrence.retained_preview', { date: occurrenceDate(date) })}
          {boundaryPreview ? (
            <>
              <span className="mt-2 block">
                {t('recurrence.first_removed', {
                  date: occurrenceDate(boundaryPreview.first_removed_date),
                  count: boundaryPreview.confirmed_transactions.length,
                })}
              </span>
              {boundaryPreview.confirmed_transactions.length > 0 && (
                <span className="mt-2 block">
                  {boundaryPreview.confirmed_transactions.map((entry) => (
                    <span className="block" key={entry.id}>
                      #{entry.id} · {entry.name} ·{' '}
                      {occurrenceDate(entry.scheduled_date)}
                      {entry.reference_date &&
                      entry.reference_date !== entry.scheduled_date
                        ? ' → ' + occurrenceDate(entry.reference_date)
                        : ''}{' '}
                      · {formatCurrency(entry.amount_cents / 100)}
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <span role="status" className="mt-2 block">
              {t(
                boundaryFailed
                  ? 'recurrence.boundary_invalid'
                  : 'common.loading',
              )}
            </span>
          )}
        </p>
      )}
      {editor.action === 'confirm' && financed && (
        <CreditFinancingFields
          value={financing ?? emptyFinancing(values.amount_cents)}
          onChange={(next, total) => {
            setFinancing(next);
            setValues({ ...values, amount_cents: total });
          }}
        />
      )}
      {editor.action === 'confirm' && credit && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || blocked}
          onClick={() => {
            if (!financialActionsBlocked()) {
              setSplit(true);
            }
          }}
        >
          {t('financing.installments')}
        </Button>
      )}
      {editor.action === 'confirm' && credit && (
        <Field>
          <FieldLabel htmlFor="recurrence-invoice-month">
            {t('financing.first_invoice_month')}
          </FieldLabel>
          <Input
            id="recurrence-invoice-month"
            type="month"
            value={invoiceMonth ?? ''}
            onChange={(event) => {
              setInvoiceMonth(event.target.value || null);
              setInvoiceId(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t('financing.invoice_month_hint')}
          </p>
        </Field>
      )}
      {editor.action === 'confirm' && credit && (
        <Field>
          <FieldLabel htmlFor="recurrence-invoice">
            {t('cards.invoice')}
          </FieldLabel>
          <Select
            value={invoiceId}
            items={[
              { value: null, label: t('cards.automatic') },
              ...invoices.map((row) => ({
                value: row.id,
                label: `#${row.id} · ${occurrenceDate(row.due_date)}`,
              })),
            ]}
            onValueChange={(id) => {
              setInvoiceMonth(null);
              setInvoiceId(Number(id) || null);
            }}
          >
            <SelectTrigger id="recurrence-invoice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{t('cards.automatic')}</SelectItem>
              {invoices.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  #{row.id} · {occurrenceDate(row.due_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {billingLoading && (
            <p role="status" className="text-xs">
              {t('common.loading')}
            </p>
          )}
          {billingFailed && (
            <p role="alert" className="text-xs text-expense">
              {t('recurrence.billing_unavailable')}
            </p>
          )}
        </Field>
      )}
      {editor.action === 'confirm' && (
        <p className="text-xs text-muted-foreground">
          {t('recurrence.cash_flow', {
            date: credit
              ? dueDate
                ? occurrenceDate(dueDate)
                : '—'
              : occurrenceDate(date),
          })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            busy ||
            blocked ||
            ((editor.action === 'pause' || editor.action === 'end') &&
              !boundaryPreview) ||
            (editor.action === 'confirm' &&
              credit &&
              (billingFailed || billingLoading))
          }
        >
          {t(busy ? 'transactions.saving' : 'recurrence.save')}
        </Button>
      </div>
    </form>
  );

  if (split && occurrence && editor.action === 'confirm') {
    return (
      <PlanDialog
        month={date.slice(0, 7)}
        occurrence={occurrence}
        initial={{
          name: values.name,
          total_amount_cents: values.amount_cents,
          payment_id: values.payment_id,
          category_id: values.category_id,
          card_id: values.credit_card_id,
          purchase_at: date,
          start_date: date,
          ...installmentInvoiceSelection(invoiceMonth, invoiceId),
          financing: financed
            ? (financing ?? emptyFinancing(values.amount_cents))
            : null,
        }}
        onClose={onClose}
        onSaved={
          onInstallmentSaved ?? (() => useAppStore.getState().refreshMonth())
        }
      />
    );
  }

  if (editor.action === 'create') {
    return (
      <div className="my-5 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">{t('recurrence.create')}</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('recurrence.defaults_hint')}
        </p>
        {form}
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (busy) {
          details.cancel();
        } else if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        finalFocus={() => (returnFocus?.isConnected ? returnFocus : false)}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t(`recurrence.${editor.action}`)}</DialogTitle>
          <DialogDescription>
            {t(
              editor.action === 'confirm'
                ? 'recurrence.confirm_hint'
                : defaultsForm
                  ? 'recurrence.defaults_hint'
                  : 'recurrence.boundary_hint',
            )}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
