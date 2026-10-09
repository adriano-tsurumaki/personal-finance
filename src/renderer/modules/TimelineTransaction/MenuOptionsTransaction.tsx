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

interface TransactionActions {
  onEdit: () => Promise<void>;
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
  const isRemoving = useRef(false);
  const { loadTransaction, isSubmitting } = useDialogTransactionStore(
    (state) => ({
      loadTransaction: state.loadTransaction,
      isSubmitting: state.isSubmitting,
    }),
  );

  const handleEdit = async () => {
    const sessionVersion = useProfileStore.getState().sessionVersion;

    try {
      await loadTransaction(transactionId);
    } catch (error) {
      if (useProfileStore.getState().sessionVersion !== sessionVersion) {
        return;
      }

      console.error('Failed to load transaction:', error);
      toast.add({
        title: t('common.errorTitle'),
        description: t('transactions.loadError'),
      });
    }
  };

  const handleRemove = async () => {
    if (isRemoving.current) {
      return;
    }

    isRemoving.current = true;
    const sessionVersion = useProfileStore.getState().sessionVersion;
    const isCurrentSession = () =>
      useProfileStore.getState().sessionVersion === sessionVersion;

    try {
      const confirmed = await confirmation.confirm({
        title: t('transactions.confirmRemove'),
        description: t('transactions.irreversible'),
        confirmLabel: t('common.remove'),
        destructive: true,
      });

      if (!confirmed || !isCurrentSession()) {
        return;
      }

      await window.api.deleteTransaction(transactionId);

      if (!isCurrentSession()) {
        return;
      }

      const { loadTransactions, loadMonthlyStatement } = useAppStore.getState();

      try {
        await Promise.all([loadTransactions(), loadMonthlyStatement()]);
      } catch (error) {
        if (!isCurrentSession()) {
          return;
        }

        console.error(
          'Removed the transaction but failed to refresh the timeline:',
          error,
        );
        toast.add({
          title: t('transactions.removedTitle'),
          description: t('transactions.refreshError'),
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
        title: t('common.errorTitle'),
        description: t('transactions.removeError'),
      });
    } finally {
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
          onRemove: handleRemove,
          disabled: isSubmitting,
        })}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit} disabled={isSubmitting}>
          {t('common.edit')}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRemove} disabled={isSubmitting}>
          {t('common.remove')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
