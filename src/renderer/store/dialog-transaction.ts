import type { TransactionInput } from '@shared/contracts/transaction';
import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/shallow';

interface State {
  /**
   * The ID of the transaction currently being edited or viewed in the dialog.
   * If null, no transaction is selected.
   */
  transactionId: number | null;
  isDialogTransactionOpen: boolean;
  modeDialogTransaction: 'add' | 'edit';
  transaction: TransactionInput;
  isSubmitting: boolean;
  startSubmission: () => number | null;
  isCurrentSubmission: (submissionId: number) => boolean;
  finishSubmission: (saved: boolean, submissionId: number) => void;
  resetSession: () => void;

  openDialogTransaction: () => void;
  closeDialogTransaction: () => void;
  setModeDialogTransaction: (mode: 'add' | 'edit') => void;
  /**
   * Loads a transaction into the dialog for editing or viewing.
   * @param id
   * @returns
   */
  loadTransaction: (id: number) => Promise<void>;
  handleTransaction: (field: string, value: unknown) => void;
  resetTransaction: () => void;
}

const emptyTransaction: TransactionInput = {
  amount_cents: 0,
  name: '',
  note: null,
  type: 1,
  category_id: null,
  payment_id: 0,
  user_id: 0,
  reference_date: '',
  payment_date: null,
};

export function createDialogTransactionStore(
  getTransaction: (id: number) => Promise<TransactionInput> = (id) =>
    window.api.getTransaction(id),
) {
  let requestId = 0;

  return createStore<State>((set, get) => ({
    transactionId: null,
    isDialogTransactionOpen: false,
    modeDialogTransaction: 'add',
    transaction: emptyTransaction,
    isSubmitting: false,
    resetSession: () => {
      requestId++;
      set({
        transactionId: null,
        isDialogTransactionOpen: false,
        modeDialogTransaction: 'add',
        transaction: { ...emptyTransaction },
        isSubmitting: false,
      });
    },
    startSubmission: () => {
      if (get().isSubmitting) {
        return null;
      }

      requestId++;
      set({ isSubmitting: true });
      return requestId;
    },
    isCurrentSubmission: (submissionId) =>
      submissionId === requestId && get().isSubmitting,
    finishSubmission: (saved, submissionId) => {
      if (!get().isCurrentSubmission(submissionId)) {
        return;
      }

      set(
        saved
          ? {
              isSubmitting: false,
              isDialogTransactionOpen: false,
              transactionId: null,
              modeDialogTransaction: 'add',
              transaction: emptyTransaction,
            }
          : { isSubmitting: false },
      );
    },

    openDialogTransaction: () => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;
      set({
        isDialogTransactionOpen: true,
        modeDialogTransaction: 'add',
        transactionId: null,
        transaction: emptyTransaction,
      });
    },
    closeDialogTransaction: () => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;
      set({ isDialogTransactionOpen: false });
    },
    setModeDialogTransaction: (mode) => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;
      set({ modeDialogTransaction: mode });
    },
    loadTransaction: async (id) => {
      if (get().isSubmitting) {
        return;
      }

      const currentRequestId = ++requestId;
      let transaction: TransactionInput;

      try {
        transaction = await getTransaction(id);
      } catch (error) {
        if (currentRequestId !== requestId) {
          return;
        }

        throw error;
      }

      if (currentRequestId !== requestId || get().isSubmitting) {
        return;
      }

      if (!transaction) {
        console.error(`Transaction with ID ${id} not found.`);
        return;
      }

      set({
        transactionId: id,
        transaction,
        modeDialogTransaction: 'edit',
        isDialogTransactionOpen: true,
      });
    },
    handleTransaction: (field, value) => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;
      set((state) => ({
        transaction: {
          ...state.transaction,
          [field]: value,
        } as TransactionInput,
      }));
    },
    resetTransaction: () => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;
      set({
        transactionId: null,
        modeDialogTransaction: 'add',
        transaction: emptyTransaction,
      });
    },
  }));
}

export const dialogTransactionStore = createDialogTransactionStore();

export function useDialogTransactionStore<T>(selector: (state: State) => T): T {
  return useStore(dialogTransactionStore, useShallow(selector));
}
