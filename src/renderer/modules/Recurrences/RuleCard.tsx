import { useRef } from 'react';
import { Menu } from '@base-ui/react/menu';
import { EllipsisVertical, Repeat } from 'lucide-react';
import { Button } from '@components/ui/button';
import { t } from '@lib/i18n';
import { formatCurrency } from '@lib/format/currency';
import { financialActionsBlocked } from '@store/financial-operations';
import type { RecurrenceRuleDto } from '@shared/contracts/recurrence';
import { monthlyEquivalent } from './presentation';
import { occurrenceDate } from './OccurrenceSummary';

export default function RuleCard({
  rule,
  blocked,
  onEdit,
  onDismiss,
}: {
  rule: RecurrenceRuleDto;
  blocked: boolean;
  onEdit: (action: 'edit' | 'pause' | 'resume' | 'end') => void;
  onDismiss: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const version = rule.versions.at(-1);
  const actions =
    rule.status === 'active'
      ? (['edit', 'pause', 'end'] as const)
      : rule.status === 'paused'
        ? (['edit', 'resume', 'end'] as const)
        : [];
  return (
    <li
      className={`rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-within:border-ring ${rule.status === 'paused' ? 'opacity-55' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${version?.type === 1 ? 'bg-income/10 text-income' : 'bg-primary/10 text-primary'}`}
        >
          <Repeat className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="wrap-break-words text-sm font-semibold">
            {rule.name}
          </h3>
          <p
            className={`mt-1 text-xs ${rule.status === 'repair_required' ? 'text-expense' : 'text-muted-foreground'}`}
          >
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
          className={`shrink-0 font-mono text-sm tabular-nums ${version?.type === 1 ? 'text-income' : 'text-expense'}`}
        >
          {version && formatCurrency(version.amount_cents / 100)}
        </span>
        {(actions.length > 0 || rule.status === 'repair_required') && (
          <Menu.Root>
            <Menu.Trigger
              disabled={blocked}
              render={
                <Button
                  ref={trigger}
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('recurrence.actions', { name: rule.name })}
                />
              }
            >
              <EllipsisVertical aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={4} className="z-50">
                <Menu.Popup className="min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                  {actions.map((action) => (
                    <Menu.Item
                      key={action}
                      disabled={blocked}
                      className="cursor-default rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      onClick={() => {
                        if (!financialActionsBlocked()) {
                          trigger.current?.focus();
                          onEdit(action);
                        }
                      }}
                    >
                      {t(`recurrence.${action}`)}
                    </Menu.Item>
                  ))}
                  {rule.status === 'repair_required' && (
                    <Menu.Item
                      disabled={blocked}
                      className="cursor-default rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      onClick={() => {
                        if (!financialActionsBlocked()) {
                          onDismiss();
                        }
                      }}
                    >
                      {t('recurrence.dismiss_legacy')}
                    </Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </li>
  );
}
