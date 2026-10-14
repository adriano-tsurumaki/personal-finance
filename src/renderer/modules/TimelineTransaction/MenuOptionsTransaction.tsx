import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import { t } from '@lib/i18n';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@components/ui/context-menu';
import { useDialogTransactionStore } from '@store/dialog-transaction';
import { toast } from '@components/ui/toast';
import { confirmation } from '@store/confirmation';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { useRef } from 'react';
import { creditCardStore } from '@store/credit-cards';
import { confirmCardCorrection } from '@lib/card-corrections';

interface TransactionActions {
  onEdit: () => Promise<void>;
  onCopy: () => Promise<void>;
  onRemove: () => Promise<void>;
  disabled: boolean;
}

export default function MenuOptionsTransaction({
  children,
  transactionId,
}: {
  children: (actions: TransactionActions) => React.ReactNode;
  transactionId: number;
}) {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const isRemoving = useRef(false);
  const { loadTransaction, isSubmitting } = useDialogTransactionStore(
    (state) => ({
      loadTransaction: state.loadTransaction,
      isSubmitting: state.isSubmitting,
    }),
  );

  const handleLoad = async (mode: 'edit' | 'copy') => {
    const sessionVersion = useProfileStore.getState().sessionVersion;

    try {
      await loadTransaction(transactionId, mode);
    } catch (error) {
      if (useProfileStore.getState().sessionVersion !== sessionVersion) {
        return;
      }

      console.error('Failed to load transaction:', error);
      toast.add({
        title: t('common.error_title'),
        description: t('transactions.load_error'),
      });
    }
  };

  const handleEdit = () => handleLoad('edit');
  const handleCopy = () => handleLoad('copy');

  const handleRemove = async () => {
    if (isRemoving.current || financialActionsBlocked()) {
      return;
    }

    const release = useFinancialOperations.getState().begin('mutation');
    isRemoving.current = true;
    const sessionVersion = useProfileStore.getState().sessionVersion;
    const isCurrentSession = () =>
      useProfileStore.getState().sessionVersion === sessionVersion;

    try {
      const confirmed = await confirmation.confirm({
        title: t('transactions.confirm_remove'),
        description: t('transactions.irreversible'),
        confirmLabel: t('common.remove'),
        destructive: true,
      });

      if (!confirmed || !isCurrentSession()) {
        return;
      }

      const plan = await window.api.previewTransactionDeletion(transactionId);

      if (!isCurrentSession()) {
        return;
      }

      if (
        plan.changes.length &&
        (!(await confirmCardCorrection(plan)) || !isCurrentSession())
      ) {
        return;
      }

      await window.api.deleteTransaction(transactionId, plan.token);

      if (!isCurrentSession()) {
        return;
      }

      const { refreshMonth } = useAppStore.getState();

      try {
        await Promise.all([
          refreshMonth(),
          creditCardStore.getState().refresh(),
        ]);
      } catch (error) {
        if (!isCurrentSession()) {
          return;
        }

        console.error(
          'Removed the transaction but failed to refresh the timeline:',
          error,
        );
        toast.add({
          title: t('transactions.removed_title'),
          description: t('transactions.refresh_error'),
        });
        return;
      }

      if (!isCurrentSession()) {
        return;
      }

      toast.add({
        title: t('common.success'),
        description: t('transactions.removed'),
      });
    } catch (error) {
      if (!isCurrentSession()) {
        return;
      }

      console.error('Failed to remove transaction:', error);
      toast.add({
        title: t('common.error_title'),
        description: t('transactions.remove_error'),
      });
    } finally {
      release();
      isRemoving.current = false;
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<li />}
        className="group/transaction mb-4 rounded-lg transition-colors duration-150 ease-in-out hover:bg-secondary/40 motion-reduce:transition-none"
      >
        {children({
          onEdit: handleEdit,
          onCopy: handleCopy,
          onRemove: handleRemove,
          disabled: isSubmitting || blocked,
        })}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={handleEdit}
          disabled={isSubmitting || blocked}
        >
          {t('common.edit')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCopy}
          disabled={isSubmitting || blocked}
        >
          {t('common.copy')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleRemove}
          disabled={isSubmitting || blocked}
        >
          {t('common.remove')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
