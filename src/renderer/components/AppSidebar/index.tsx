import { useId, useState } from 'react';
import {
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Repeat,
  Tags,
  Wallet,
  Waypoints,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { t } from '@lib/i18n';
import { cn } from '@lib/utils';
import ProfileMenu from '@modules/Profiles/ProfileMenu';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@components/ui/tooltip';

export type AppDestination = 'timeline' | 'categories' | 'recurrences';

interface SidebarItem {
  label: Parameters<typeof t>[0];
  icon: typeof Tags;
  destination?: AppDestination;
}

const groups: {
  label: Parameters<typeof t>[0];
  items: SidebarItem[];
}[] = [
  {
    label: 'sidebar.overview',
    items: [
      { label: 'sidebar.dashboard', icon: LayoutDashboard },
      { label: 'sidebar.timeline', icon: Waypoints, destination: 'timeline' },
    ],
  },
  {
    label: 'sidebar.organization',
    items: [
      { label: 'sidebar.categories', icon: Tags, destination: 'categories' },
      { label: 'sidebar.cards', icon: CreditCard },
    ],
  },
  {
    label: 'sidebar.commitments',
    items: [
      { label: 'sections.recurring', icon: Repeat, destination: 'recurrences' },
      { label: 'sidebar.invoices', icon: ReceiptText },
      { label: 'sidebar.installments', icon: CalendarRange },
    ],
  },
];

export default function AppSidebar({
  destination,
  onNavigate,
}: {
  destination: AppDestination;
  onNavigate: (destination: AppDestination) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const contentId = useId();
  const hintId = useId();
  const toggleLabel = t(expanded ? 'sidebar.collapse' : 'sidebar.expand');

  // Resizing the shell is local UI state and does not conflict with financial work.
  return (
    <aside
      aria-label={t('sidebar.label')}
      className={cn(
        'flex min-h-0 min-w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 motion-reduce:transition-none',
        expanded ? 'w-56 max-w-[45vw]' : 'w-14',
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 overflow-hidden px-4.5 text-sm font-medium text-sidebar-primary">
        <Wallet className="size-5 shrink-0" aria-hidden="true" />
        <span className={expanded ? 'truncate' : 'sr-only'}>Ledger</span>
      </div>
      <div className="px-2.5 pb-2">
        <Button
          variant="ghost"
          size={expanded ? 'lg' : 'icon-lg'}
          className={cn(
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            expanded && 'w-full justify-start gap-3',
          )}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" />
          ) : (
            <PanelLeftOpen aria-hidden="true" />
          )}
          {expanded && <span className="truncate">{toggleLabel}</span>}
        </Button>
      </div>
      <nav
        id={contentId}
        aria-label={t('sidebar.navigation')}
        className="min-h-0 flex-1 overflow-y-auto px-2.5"
      >
        {groups.map((group, index) => (
          <section
            key={group.label}
            aria-label={t(group.label)}
            className={cn(
              'py-3',
              index > 0 && 'border-t border-sidebar-border',
            )}
          >
            <h2
              className={
                expanded
                  ? 'mb-2 truncate px-2.5 text-xs font-medium text-sidebar-foreground/60'
                  : 'sr-only'
              }
            >
              {t(group.label)}
            </h2>
            <ul className="space-y-1">
              {group.items.map(({ label, icon: Icon, destination: target }) => (
                <li key={label}>
                  <Tooltip>
                    <TooltipTrigger
                      disabled={expanded}
                      render={
                        <button
                          type="button"
                          aria-disabled={!target || blocked}
                          aria-current={
                            target === destination ? 'page' : undefined
                          }
                          aria-label={t(label)}
                          aria-describedby={!target ? hintId : undefined}
                          onClick={() => {
                            if (target && !financialActionsBlocked()) {
                              onNavigate(target);
                            }
                          }}
                          title={
                            expanded
                              ? target
                                ? t(label)
                                : `${t(label)} · ${t('sidebar.deferred')}`
                              : ''
                          }
                          className={cn(
                            'flex h-9 items-center rounded-lg',
                            !target || blocked
                              ? 'cursor-not-allowed text-sidebar-foreground/50'
                              : 'cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            target === destination &&
                              'bg-sidebar-accent text-sidebar-accent-foreground',
                            expanded
                              ? 'w-full gap-3 px-2.5'
                              : 'w-9 justify-center',
                          )}
                        >
                          <Icon
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {expanded && (
                            <span className="truncate text-sm">{t(label)}</span>
                          )}
                        </button>
                      }
                    />
                    <TooltipContent side="right">
                      {target
                        ? t(label)
                        : `${t(label)} · ${t('sidebar.deferred')}`}
                    </TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        <p
          id={hintId}
          className={
            expanded
              ? 'mb-3 px-2.5 text-xs text-sidebar-foreground/60'
              : 'sr-only'
          }
        >
          {t('sidebar.deferred')}
        </p>
        <ProfileMenu expanded={expanded} />
      </div>
    </aside>
  );
}
