import { useEffect, useRef, useState } from 'react';
import { Archive, Pencil, Plus, Tags } from 'lucide-react';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { categoryLabel, t } from '@lib/i18n';
import { getCategoryIcon } from '@lib/category-icons';
import { useProfileStore } from '@store/profile';
import { useAppStore } from '@store/transaction';
import { confirmation } from '@store/confirmation';
import type {
  CategoryDto,
  CategoryMutationResult,
} from '@shared/contracts/categories';
import CategoryDialog from './CategoryDialog';

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<CategoryDto | 'new' | null>(null);
  const mounted = useRef(false);
  const mutationPending = useRef(false);
  const returnFocus = useRef<HTMLButtonElement>(null);
  const sessionVersion = useProfileStore((state) => state.sessionVersion);
  const current = () =>
    mounted.current &&
    useProfileStore.getState().sessionVersion === sessionVersion;

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

  async function mutate(operation: () => Promise<CategoryMutationResult>) {
    if (mutationPending.current) {
      return;
    }

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
          title: t('common.errorTitle'),
          description: t(`categoryManager.${result.error}`),
        });
        return;
      }

      saved = true;
      toast.add({
        title: t('common.success'),
        description: t('categoryManager.saved'),
      });
      try {
        const options = await window.api.getProfileOptions();

        if (!current()) {
          return;
        }

        useProfileStore.setState({ options });
        await Promise.all([load(), useAppStore.getState().loadTransactions()]);
      } catch {
        if (current()) {
          toast.add({
            title: t('common.errorTitle'),
            description: t('categoryManager.refreshError'),
          });
        }
      }
    } catch {
      if (current()) {
        toast.add({
          title: t('common.errorTitle'),
          description: t('common.error'),
        });
      }
    } finally {
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
    const confirmed = await confirmation.confirm({
      title: t('categoryManager.confirmArchive', {
        name: categoryLabel(category),
      }),
      description: t('categoryManager.archiveHint'),
      confirmLabel: t('categoryManager.archive'),
    });

    if (confirmed && current()) {
      await mutate(() => window.api.archiveCategory(category.id));
    }
  }

  return (
    <section
      className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10"
      aria-labelledby="categories-title"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="categories-title"
          className="flex items-center gap-2 text-sm font-medium text-primary"
        >
          <Tags className="size-4" aria-hidden="true" />
          {t('categoryManager.title')}
        </h2>
        <Button
          disabled={busy}
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setEditor('new');
          }}
        >
          <Plus aria-hidden="true" />
          {t('categoryManager.add')}
        </Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {t('categoryManager.hint')}
      </p>
      {loading && categories.length === 0 ? (
        <p role="status">{t('common.loading')}</p>
      ) : failed ? (
        <div role="alert">
          <p className="mb-3 text-sm">{t('common.error')}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('categoryManager.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon_key);
            return (
              <li
                key={category.id}
                className={`flex items-center gap-3 rounded-lg border border-border bg-card p-4 ${category.archived_at ? 'opacity-55' : ''}`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    color: category.color,
                    borderColor: category.color,
                    backgroundColor: `${category.color}1a`,
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="wrap-break-words text-sm font-medium">
                    {categoryLabel(category)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`categoryManager.${category.transaction_type}`)}
                    {category.archived_at &&
                      ` · ${t('categoryManager.archived')}`}
                  </p>
                  {category.description && (
                    <p className="mt-1 wrap-break-words text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={t('categoryManager.editLabel', {
                    name: categoryLabel(category),
                  })}
                  onClick={(event) => {
                    returnFocus.current = event.currentTarget;
                    setEditor(category);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                {!category.archived_at && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={t('categoryManager.archiveLabel', {
                      name: categoryLabel(category),
                    })}
                    onClick={() => void archive(category)}
                  >
                    <Archive aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editor !== null && (
        <CategoryDialog
          key={editor === 'new' ? 'new' : editor.id}
          category={editor === 'new' ? null : editor}
          busy={busy}
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
