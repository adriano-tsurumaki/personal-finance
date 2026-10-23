import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  ReceiptText,
} from 'lucide-react';
import type { CardHistoryChange } from '@shared/contracts/credit-cards';
import { cardChangeFields } from '@lib/card-history';
import { getLocale, t } from '@lib/i18n';

export default function CardChanges({
  changes,
  affectedMonths = [],
}: {
  changes: CardHistoryChange[];
  affectedMonths?: string[];
}) {
  return (
    <div className="space-y-3">
      {affectedMonths.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <CalendarClock
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed">
            {t('cards.affected_months', {
              months: affectedMonths
                .map((month) =>
                  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(
                    getLocale(),
                    { month: 'long', year: 'numeric', timeZone: 'UTC' },
                  ),
                )
                .join(', '),
            })}
          </p>
        </div>
      )}
      {changes.map((change) => {
        const Icon = change.entity === 'card' ? CreditCard : ReceiptText;
        const name = change.after?.name ?? change.before?.name;
        return (
          <section
            key={`${change.entity}-${change.id}`}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
              <Icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <h4 className="min-w-0 flex-1 truncate text-xs font-medium">
                {typeof name === 'string' ? name : t(`cards.${change.entity}`)}
              </h4>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                #{change.id}
              </span>
            </div>
            <dl className="divide-y divide-border">
              {cardChangeFields(change).map((field) => (
                <div key={field.field} className="px-3 py-3">
                  <dt className="mb-2 text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-muted-foreground">
                        {t('cards.before')}
                      </span>
                      <span
                        className={`block break-words text-xs tabular-nums ${field.field.endsWith('_cents') ? 'font-mono' : ''}`}
                      >
                        {field.before}
                      </span>
                    </div>
                    <ArrowRight
                      className="size-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 rounded-md bg-primary/5 px-2 py-1">
                      <span className="block text-[10px] text-muted-foreground">
                        {t('cards.after')}
                      </span>
                      <span
                        className={`block break-words text-xs font-medium tabular-nums ${field.field.endsWith('_cents') ? 'font-mono' : ''}`}
                      >
                        {field.after}
                      </span>
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
