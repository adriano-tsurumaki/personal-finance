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
    try {
      await loadTransaction(transactionId);
    } catch (error) {
      console.error('Failed to load transaction:', error);
      toast.add({
        title: 'Error',
        description: 'Could not load the transaction. Please try again.',
      });
    }
  };

  const handleRemove = async () => {
    if (isRemoving.current) {
      return;
    }

    isRemoving.current = true;

    try {
      const confirmed = await confirmation.confirm({
        title: 'Remove this transaction?',
        description: 'This action cannot be undone.',
        confirmLabel: 'Remove',
        destructive: true,
      });

      if (!confirmed) {
        return;
      }

      await window.api.deleteTransaction(transactionId);

      const { loadTransactions, loadMonthlyStatement } = useAppStore.getState();

      try {
        await Promise.all([loadTransactions(), loadMonthlyStatement()]);
      } catch (error) {
        console.error(
          'Removed the transaction but failed to refresh the timeline:',
          error,
        );
        toast.add({
          title: 'Transaction removed',
          description:
            'Could not refresh the timeline. Reload it to see the changes.',
        });
        return;
      }
      toast.add({
        title: 'Success',
        description: 'Transaction removed successfully.',
      });
    } catch (error) {
      console.error('Failed to remove transaction:', error);
      toast.add({
        title: 'Error',
        description: 'Could not remove the transaction. Please try again.',
      });
    } finally {
      isRemoving.current = false;
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<li />}
        className="group/transaction mb-4 rounded-lg transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-secondary/40 motion-reduce:transition-none"
      >
        {children({
          onEdit: handleEdit,
          onRemove: handleRemove,
          disabled: isSubmitting,
        })}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit} disabled={isSubmitting}>
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRemove} disabled={isSubmitting}>
          Remove
        </ContextMenuItem>
        <ContextMenuItem>Make a copy</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
