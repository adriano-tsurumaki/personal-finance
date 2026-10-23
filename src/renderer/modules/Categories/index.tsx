import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  LayoutGrid,
  Plus,
  Search,
  Tags,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { categoryLabel, t } from '@lib/i18n';
import { Input } from '@components/ui/input';
import { currentMonthKey } from '@shared/lib/calc';
import { formatYearMonthToString } from '@lib/format/currency';
import CategoryCard from './CategoryCard';
import { filterCategories, type CategoryFilter } from './presentation';
import { useProfileStore } from '@store/profile';
import { useAppStore } from '@store/transaction';
import { confirmation } from '@store/confirmation';
import type {
  CategoryActivityDto,
  CategoryDto,
  CategoryMutationResult,
} from '@shared/contracts/categories';
import CategoryDialog from './CategoryDialog';

export default function Categories() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthKey);
  const [activity, setActivity] = useState<CategoryActivityDto[] | null>(null);
  const [activityFailed, setActivityFailed] = useState(false);
  const activityRequest = useRef(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const [editor, setEditor] = useState<CategoryDto | 'new' | null>(null);
  const mounted = useRef(false);
  const mutationPending = useRef(false);
  const returnFocus = useRef<HTMLButtonElement>(null);
  const sessionVersion = useProfileStore((state) => state.sessionVersion);
  const current = () =>
    mounted.current &&
    useProfileStore.getState().sessionVersion === sessionVersion;

  // These reads publish only into this mounted screen, so navigation can remain available.
  async function loadActivity() {
    const request = ++activityRequest.current;
    setActivity(null);
    setActivityFailed(false);
    try {
      const result = await window.api.getCategoryActivity(month);

      if (current() && request === activityRequest.current) {
        setActivity(result);
      }
    } catch {
      if (current() && request === activityRequest.current) {
        setActivityFailed(true);
      }
    }
  }

  useEffect(() => {
    const update = () => setMonth(currentMonthKey());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

  async function load() {
    setLoading(true);
    setFailed(false);
    try {
      const rows = await window.api.getCategories();

      if (current()) {
        setCategories(rows);
      }
    } catch {
      if (current()) {
        setFailed(true);
      }
    } finally {
      if (current()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
    // The profile owns this mounted view; session changes invalidate its responses.
  }, [sessionVersion]);

  useEffect(() => {
    void loadActivity();
    return () => {
      activityRequest.current += 1;
    };
  }, [month, sessionVersion]);

  async function mutate(operation: () => Promise<CategoryMutationResult>) {
    if (mutationPending.current || financialActionsBlocked()) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    mutationPending.current = true;
    setBusy(true);
    let saved = false;
    try {
      const result = await operation();

      if (!current()) {
        return;
      }

      if (!result.ok) {
        toast.add({
          title: t('common.error_title'),
          description: t(`category_manager.${result.error}`),
        });
        return;
      }

      saved = true;
      toast.add({
        title: t('common.success'),
        description: t('category_manager.saved'),
      });
      try {
        const options = await window.api.getProfileOptions();

        if (!current()) {
          return;
        }

        useProfileStore.setState({ options });
        await Promise.all([
          load(),
          loadActivity(),
          useAppStore.getState().loadTransactions(),
        ]);
      } catch {
        if (current()) {
          toast.add({
            title: t('common.error_title'),
            description: t('category_manager.refresh_error'),
          });
        }
      }
    } catch {
      if (current()) {
        toast.add({
          title: t('common.error_title'),
          description: t('common.error'),
        });
      }
    } finally {
      release();
      mutationPending.current = false;

      if (current()) {
        setBusy(false);

        if (saved) {
          setEditor(null);
        }
      }
    }
  }

  async function archive(category: CategoryDto) {
    if (financialActionsBlocked()) {
      return;
    }

    const confirmed = await confirmation.confirm({
      title: t('category_manager.confirm_archive', {
        name: categoryLabel(category),
      }),
      description: t('category_manager.archive_hint'),
      confirmLabel: t('category_manager.archive'),
    });

    if (confirmed && current()) {
      await mutate(() => window.api.archiveCategory(category.id));
    }
  }

  const filtered = filterCategories(categories, query, filter);
  const active = filtered.filter((category) => !category.archived_at);
  const archived = filtered.filter((category) => category.archived_at);
  const activityByCategory = new Map(
    activity?.map((item) => [item.category_id, item]),
  );
  const showArchived = archivedOpen;
  const [year, monthNumber] = month.split('-').map(Number);
  const filters = [
    { value: 'all', label: 'category_manager.all', icon: LayoutGrid },
    {
      value: 'expense',
      label: 'category_manager.expense',
      icon: ArrowDownLeft,
    },
    { value: 'income', label: 'category_manager.income', icon: ArrowUpRight },
    { value: 'archived', label: 'category_manager.archived', icon: Archive },
  ] as const;

  function renderGrid(rows: CategoryDto[]) {
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            activity={activityByCategory.get(category.id)}
            activityAvailable={activity !== null}
            blocked={blocked}
            onEdit={(selected, trigger) => {
              if (financialActionsBlocked()) {
                return;
              }

              returnFocus.current = trigger;
              setEditor(selected);
            }}
            onArchive={(selected) => void archive(selected)}
          />
        ))}
      </ul>
    );
  }

  return (
    <section
      className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"
      aria-labelledby="categories-title"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="categories-title"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <Tags className="size-5" aria-hidden="true" />
            {t('category_manager.title')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t('category_manager.hint')}
          </p>
        </div>
        <Button
          disabled={blocked}
          onClick={(event) => {
            if (financialActionsBlocked()) {
              return;
            }

            returnFocus.current = event.currentTarget;
            setEditor('new');
          }}
        >
          <Plus aria-hidden="true" />
          {t('category_manager.add')}
        </Button>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_16rem]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('category_manager.search')}
            placeholder={t('category_manager.search')}
          />
        </div>
        <div
          role="group"
          aria-label={t('category_manager.filters')}
          className="flex flex-wrap gap-2"
        >
          {filters.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'outline'}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);

                if (value === 'archived') {
                  setArchivedOpen(true);
                }
              }}
            >
              <Icon aria-hidden="true" />
              {t(label)}
            </Button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('category_manager.activity_period', {
          month: formatYearMonthToString(year, monthNumber),
        })}
      </p>
      {activityFailed ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
        >
          <p>{t('category_manager.activity_error')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadActivity()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        activity === null && (
          <p role="status" className="mb-4 text-xs text-muted-foreground">
            {t('category_manager.activity_loading')}
          </p>
        )
      )}
      {loading && categories.length === 0 ? (
        <p role="status">{t('common.loading')}</p>
      ) : failed ? (
        <div role="alert">
          <p className="mb-3 text-sm">{t('common.error')}</p>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <>
          {filter !== 'archived' &&
            (active.length > 0 ? (
              renderGrid(active)
            ) : (
              <p
                role="status"
                className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
              >
                {t(
                  categories.length === 0
                    ? 'category_manager.empty'
                    : 'category_manager.no_results',
                )}
              </p>
            ))}
          <div className="mt-5 rounded-xl border border-border">
            <h2>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl p-4 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
                aria-expanded={showArchived}
                aria-controls="archived-categories"
                onClick={() => {
                  setArchivedOpen(!showArchived);
                }}
              >
                <Archive className="size-4" aria-hidden="true" />
                {t('category_manager.archived_count', {
                  count: archived.length,
                })}
                <ChevronDown
                  className={`ml-auto size-4 transition-transform motion-reduce:transition-none ${showArchived ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </h2>
            <div
              id="archived-categories"
              hidden={!showArchived}
              className="p-3 pt-0"
            >
              {archived.length > 0 ? (
                renderGrid(archived)
              ) : (
                <p role="status" className="p-4 text-sm text-muted-foreground">
                  {t('category_manager.no_archived')}
                </p>
              )}
            </div>
          </div>
        </>
      )}
      {editor !== null && (
        <CategoryDialog
          key={editor === 'new' ? 'new' : editor.id}
          category={editor === 'new' ? null : editor}
          busy={busy || blocked}
          returnFocus={returnFocus}
          onClose={() => setEditor(null)}
          onSave={(input) =>
            mutate(() =>
              editor === 'new'
                ? window.api.createCategory(input)
                : window.api.updateCategory(editor.id, input),
            )
          }
        />
      )}
    </section>
  );
}
