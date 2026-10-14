import type { Toast } from '@base-ui/react/toast';
import { t } from '@lib/i18n';
import { useAppStore } from '@store/transaction';

type FeedbackManager = Pick<
  ReturnType<typeof Toast.useToastManager>,
  'add' | 'close'
>;

/** Owns only this summary's notification and cleans it up on state changes or unmount. */
export function watchMonthlyStatementFeedback(
  manager: FeedbackManager,
): () => void {
  let toastId: string | undefined;
  let previousKey = '';

  function sync() {
    const state = useAppStore.getState();
    const loading = state.statementLoading;
    const failed =
      !loading && (state.failedMonth !== null || state.statementFailed);
    const month =
      (loading ? state.pendingMonth : state.failedMonth) ?? state.monthKey;
    const key = loading
      ? `loading:${month}`
      : failed
        ? `error:${month}`
        : 'idle';

    if (key === previousKey) {
      return;
    }

    previousKey = key;

    if (toastId !== undefined) {
      manager.close(toastId);
      toastId = undefined;
    }

    if (loading) {
      toastId = manager.add({
        title: t('summary.loading_month', { month }),
        type: 'loading',
        timeout: 0,
        data: { dismissible: false, instantDismiss: true },
      });
    } else if (failed) {
      toastId = manager.add({
        title: t('common.error_title'),
        description: t('summary.load_error', { month }),
        type: 'error',
        timeout: 0,
        priority: 'high',
        data: { dismissible: true, instantDismiss: true },
        actionProps: {
          children: t('common.retry'),
          onClick: () => void useAppStore.getState().setMonthKey(month),
        },
      });
    }
  }

  const unsubscribe = useAppStore.subscribe(sync);
  sync();
  return () => {
    unsubscribe();

    if (toastId !== undefined) {
      manager.close(toastId);
    }
  };
}
