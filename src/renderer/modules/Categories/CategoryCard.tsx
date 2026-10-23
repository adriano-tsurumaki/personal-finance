import { useRef } from 'react';
import { Archive, EllipsisVertical, Pencil, ReceiptText } from 'lucide-react';
import { Menu } from '@base-ui/react/menu';
import { Button } from '@components/ui/button';
import { categoryLabel, t } from '@lib/i18n';
import { getCategoryIcon } from '@lib/category-icons';
import { formatCurrency } from '@lib/format/currency';
import { financialActionsBlocked } from '@store/financial-operations';
import type {
  CategoryActivityDto,
  CategoryDto,
} from '@shared/contracts/categories';

export default function CategoryCard({
  category,
  activity,
  activityAvailable,
  blocked,
  onEdit,
  onArchive,
}: {
  category: CategoryDto;
  activity?: CategoryActivityDto;
  activityAvailable: boolean;
  blocked: boolean;
  onEdit: (category: CategoryDto, trigger: HTMLButtonElement | null) => void;
  onArchive: (category: CategoryDto) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const Icon = getCategoryIcon(category.icon_key);
  const income = category.transaction_type === 'income';
  const amount = income ? activity?.income_cents : activity?.expense_cents;
  const secondary = income ? activity?.expense_cents : activity?.income_cents;
  const daily =
    (income ? activity?.income_daily_cents : activity?.expense_daily_cents) ??
    [];
  const maximum = Math.max(1, ...daily);
  const name = categoryLabel(category);
  const menuItemClass =
    'flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50';

  return (
    <li className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary/40 focus-within:border-ring">
      <div>
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
            style={{
              color: category.color,
              borderColor: `${category.color}66`,
              backgroundColor: `${category.color}1a`,
            }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="wrap-break-words text-sm font-semibold">{name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(`category_manager.${category.transaction_type}`)}
            </p>
          </div>
          <Menu.Root>
            <Menu.Trigger
              disabled={blocked}
              render={
                <Button
                  ref={trigger}
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('category_manager.actions', { name })}
                />
              }
            >
              <EllipsisVertical aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={4} className="z-50">
                <Menu.Popup className="min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                  <Menu.Item
                    disabled={blocked}
                    className={menuItemClass}
                    onClick={() => {
                      if (!financialActionsBlocked()) {
                        onEdit(category, trigger.current);
                      }
                    }}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {t('category_manager.edit')}
                  </Menu.Item>
                  {!category.archived_at && (
                    <Menu.Item
                      disabled={blocked}
                      className={menuItemClass}
                      onClick={() => {
                        if (!financialActionsBlocked()) {
                          onArchive(category);
                        }
                      }}
                    >
                      <Archive className="size-4" aria-hidden="true" />
                      {t('category_manager.archive')}
                    </Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
        {category.description && (
          <p
            className="mt-2 line-clamp-2 wrap-break-words text-xs text-muted-foreground"
            title={category.description}
          >
            {category.description}
          </p>
        )}
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="wrap-break-words font-mono text-lg font-semibold tabular-nums">
              {activityAvailable ? formatCurrency((amount ?? 0) / 100) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                income
                  ? 'category_manager.month_income'
                  : 'category_manager.month_expense',
              )}
            </p>
          </div>
          <svg
            viewBox="0 0 124 36"
            className="h-9 w-24 shrink-0"
            role="img"
            aria-hidden={!activityAvailable}
            aria-label={t(
              income
                ? 'category_manager.income_chart'
                : 'category_manager.expense_chart',
            )}
          >
            <title>{t('category_manager.chart_hint')}</title>
            <desc>
              {daily
                .map(
                  (value, index) =>
                    `${index + 1}: ${formatCurrency(value / 100)}`,
                )
                .join('; ')}
            </desc>
            {activityAvailable &&
              daily.map((value, index) => (
                <rect
                  key={index}
                  x={index * (124 / daily.length)}
                  y={36 - (value / maximum) * 34}
                  width={Math.max(1, 124 / daily.length - 1.5)}
                  height={(value / maximum) * 34}
                  rx="0.7"
                  fill={category.color}
                >
                  <title>{`${index + 1}: ${formatCurrency(value / 100)}`}</title>
                </rect>
              ))}
            <path d="M0 35.5H124" className="stroke-border" />
          </svg>
        </div>
        <div className="mt-1 min-h-4 text-xs text-muted-foreground">
          {!!secondary && activityAvailable && (
            <p>
              {t(
                income ? 'category_manager.expense' : 'category_manager.income',
              )}
              :{' '}
              <span className="font-mono tabular-nums">
                {formatCurrency(secondary / 100)}
              </span>
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <ReceiptText className="size-3.5" aria-hidden="true" />
          {activityAvailable
            ? t('category_manager.entry_count', {
                count: activity?.entry_count ?? 0,
              })
            : '—'}
          {category.archived_at && (
            <span className="ml-auto">{t('category_manager.archived')}</span>
          )}
        </div>
      </div>
    </li>
  );
}
