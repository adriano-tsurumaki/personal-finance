import { useEffect, useRef, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { confirmation } from '@store/confirmation';
import { creditCardStore } from '@store/credit-cards';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type { InstallmentPlanDto } from '@shared/contracts/installment';
import PlanDialog from './PlanDialog';
import PlanPreview, { PlanSchedule } from './PlanPreview';
import {
  installmentError,
  planDate,
  sumInstallmentCents,
} from './presentation';

export default function Installments({
  initialCreate = false,
  onCreateClosed,
}: {
  initialCreate?: boolean;
  onCreateClosed?: () => void;
}) {
  const session = useProfileStore((state) => state.sessionVersion);
  return (
    <InstallmentContent
      key={session}
      initialCreate={initialCreate}
      onCreateClosed={onCreateClosed}
    />
  );
}

function InstallmentContent({
  initialCreate,
  onCreateClosed,
}: {
  initialCreate: boolean;
  onCreateClosed?: () => void;
}) {
  const month = useAppStore((state) => state.monthKey);
  const session = useProfileStore((state) => state.sessionVersion);
  const financialEntries = useAppStore((state) => state.transactions);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const [plans, setPlans] = useState<InstallmentPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [editor, setEditor] = useState<'create' | InstallmentPlanDto | null>(
    initialCreate ? 'create' : null,
  );
  const alive = useRef(false);
  const request = useRef(0);
  const acting = useRef(false);
  const current = () =>
    alive.current && session === useProfileStore.getState().sessionVersion;
  async function load() {
    const version = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const rows = await window.api.installment.list();

      if (current() && version === request.current) {
        setPlans(rows);
      }
    } catch {
      if (current() && version === request.current) {
        setFailed(true);
      }
    } finally {
      if (current() && version === request.current) {
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    const release = useFinancialOperations.getState().begin('period');
    void load().finally(release);
    return () => {
      alive.current = false;
      request.current++;
    };
  }, [month, financialEntries]);
  async function refresh() {
    await useAppStore.getState().refreshMonth();

    if (!current()) {
      return;
    }

    await creditCardStore.getState().refresh();

    if (current()) {
      await load();
    }
  }
  function closeEditor() {
    setEditor(null);
    onCreateClosed?.();
  }
  async function remove(plan: InstallmentPlanDto) {
    if (acting.current || financialActionsBlocked()) {
      return;
    }

    acting.current = true;
    const release = useFinancialOperations.getState().begin('mutation');
    try {
      const preview = await window.api.installment.previewRemove(plan.id);

      if (!current()) {
        return;
      }

      const approved = await confirmation.confirm({
        title: t('installments.remove'),
        description: t('installments.remove_hint'),
        confirmLabel: t('common.remove'),
        destructive: true,
        content: <PlanPreview preview={preview} />,
      });

      if (!approved || !current()) {
        return;
      }

      await window.api.installment.remove(plan.id, preview.correction.token);

      if (current()) {
        await refresh();
      }
    } catch (error) {
      if (current()) {
        toast.add({
          title: t('common.error_title'),
          description: installmentError(error),
        });
      }
    } finally {
      release();
      acting.current = false;
    }
  }
  const valid = plans.filter((plan) => !plan.repair_required);
  const entries = valid.flatMap((plan) => plan.entries);
  const monthEntries = entries.filter((row) =>
    row.reference_date.startsWith(month),
  );
  const unsettled = entries.filter(
    (row) => !row.payment_date && !row.invoice?.paid_at,
  );
  const monthTotal = sumInstallmentCents(monthEntries);
  const unrecordedTotal = sumInstallmentCents(unsettled);
  const visible = all
    ? plans
    : plans.filter(
        (plan) =>
          plan.repair_required ||
          plan.entries.some((row) => row.reference_date.startsWith(month)),
      );
  const [year, monthNumber] = month.split('-').map(Number);
  const forecast = Array.from({ length: 8 }, (_, index) => {
    const offset = year * 12 + monthNumber - 1 + index;
    const key = `${Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
    return {
      key,
      amount: sumInstallmentCents(
        entries.filter((row) => row.reference_date.startsWith(key)),
      ),
    };
  });
  const unavailable =
    loading ||
    failed ||
    monthTotal === null ||
    unrecordedTotal === null ||
    plans.some((plan) => plan.repair_required);
  return (
    <section className="mx-auto max-w-3xl space-y-5 px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="size-5 text-primary" aria-hidden="true" />
            {t('sections.installments')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('installments.intro')}
          </p>
        </div>
        <Button
          disabled={blocked}
          onClick={() => {
            if (!financialActionsBlocked()) {
              setEditor('create');
            }
          }}
        >
          <Plus aria-hidden="true" />
          {t('installments.add')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [t('installments.in_month'), formatCurrency((monthTotal ?? 0) / 100)],
          [
            t('installments.open_plans'),
            String(
              valid.filter((plan) =>
                plan.entries.some(
                  (row) => !row.payment_date && !row.invoice?.paid_at,
                ),
              ).length,
            ),
          ],
          [
            t('installments.unrecorded_total'),
            formatCurrency((unrecordedTotal ?? 0) / 100),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card/60 p-4"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 font-mono text-lg tabular-nums">
              {unavailable ? '—' : value}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('installments.settlement_hint')}
      </p>
      <div className="flex gap-2" aria-label={t('installments.view')}>
        <Button
          variant={!all ? 'default' : 'outline'}
          aria-pressed={!all}
          onClick={() => setAll(false)}
        >
          {t('installments.in_month')}
        </Button>
        <Button
          variant={all ? 'default' : 'outline'}
          aria-pressed={all}
          onClick={() => setAll(true)}
        >
          {t('installments.all')}
        </Button>
      </div>
      {loading ? (
        <p role="status">{t('installments.working')}</p>
      ) : failed ? (
        <div role="alert" className="space-y-3">
          <p>{t('installments.load_error')}</p>
          <Button
            disabled={blocked}
            variant="outline"
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
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            {visible.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t('installments.empty')}
              </p>
            )}
            {visible.map((plan) => {
              const active = plan.entries.filter((row) =>
                row.reference_date.startsWith(month),
              );
              const progressed = plan.entries.filter(
                (row) => row.reference_date.slice(0, 7) <= month,
              ).length;
              const paid = plan.entries.filter(
                (row) => row.payment_date || row.invoice?.paid_at,
              ).length;
              return (
                <article
                  key={plan.id}
                  className="rounded-lg border border-primary/20 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 break-words font-medium">
                      {plan.name}
                    </h3>
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs">
                      {progressed}/{plan.total_installments}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-lg tabular-nums">
                    {formatCurrency(
                      (active[0]?.amount_cents ??
                        plan.entries[0]?.amount_cents ??
                        0) / 100,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('installments.purchase_total')}:{' '}
                    {formatCurrency(plan.total_amount_cents / 100)} ·{' '}
                    {t('installments.count')}: {plan.total_installments}
                  </p>
                  <div
                    className="mt-3 flex h-1 w-full gap-0.5"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={plan.total_installments}
                    aria-valuenow={progressed}
                    aria-label={t('installments.schedule_progress')}
                  >
                    {Array.from(
                      {
                        length: Math.min(
                          120,
                          Math.max(0, plan.total_installments),
                        ),
                      },
                      (_, index) => (
                        <span
                          key={index}
                          className={`min-w-0 flex-1 rounded-sm ${index < progressed ? (plan.entries[index]?.reference_date.startsWith(month) ? 'bg-primary' : 'bg-primary/55') : 'bg-border'}`}
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('installments.progress', {
                      scheduled: progressed,
                      count: plan.total_installments,
                      paid,
                    })}
                  </p>
                  {plan.repair_required ? (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {t('installments.repair')}
                    </p>
                  ) : (
                    <>
                      {plan.note && (
                        <p className="mt-2 break-words text-sm text-muted-foreground">
                          {plan.note}
                        </p>
                      )}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm">
                          {t('installments.details')}
                        </summary>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('installments.purchase_date')}:{' '}
                          {planDate(plan.purchase_at)}
                        </p>
                        <PlanSchedule plan={plan} />
                      </details>
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={blocked || plan.repair_required}
                      onClick={() => {
                        if (!financialActionsBlocked()) {
                          setEditor(plan);
                        }
                      }}
                    >
                      {t('installments.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={blocked || plan.repair_required || paid > 0}
                      onClick={() => void remove(plan)}
                    >
                      {t('common.remove')}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="self-start rounded-lg border border-border bg-card p-4 md:sticky md:top-4">
            <h3 className="text-sm font-medium">
              {t('installments.forecast')}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('installments.forecast_hint')}
            </p>
            <ol className="mt-3 divide-y divide-border">
              {forecast.map((row) => (
                <li
                  key={row.key}
                  className="flex justify-between gap-2 py-2 text-xs"
                >
                  <span>{row.key}</span>
                  <span className="font-mono tabular-nums">
                    {unavailable || row.amount === null
                      ? '—'
                      : formatCurrency(row.amount / 100)}
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
      {editor && (
        <PlanDialog
          month={month}
          plan={editor === 'create' ? undefined : editor}
          onClose={closeEditor}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
