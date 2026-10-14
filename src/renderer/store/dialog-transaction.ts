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
  returnFocus: HTMLElement | null;
  startSubmission: () => number | null;
  isCurrentSubmission: (submissionId: number) => boolean;
  finishSubmission: (saved: boolean, submissionId: number) => void;
  resetSession: () => void;

  openDialogTransaction: (newTransaction?: Partial<TransactionInput>) => void;
  closeDialogTransaction: () => void;
  setModeDialogTransaction: (mode: 'add' | 'edit') => void;
  /**
   * Loads a transaction for editing or as a new creation draft.
   * @param id
   * @returns
   */
  loadTransaction: (id: number, mode?: 'edit' | 'copy') => Promise<void>;
  handleTransaction: (field: string, value: unknown) => void;
  resetTransaction: () => void;
}

const emptyTransaction: TransactionInput = {
  amount_cents: 0,
  name: '',
  note: null,
  type: 2,
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
    returnFocus: null,

    resetSession: () => {
      requestId++;
      set({
        transactionId: null,
        isDialogTransactionOpen: false,
        modeDialogTransaction: 'add',
        transaction: { ...emptyTransaction },
        isSubmitting: false,
        returnFocus: null,
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

    openDialogTransaction: (newTransaction) => {
      if (get().isSubmitting) {
        return;
      }

      requestId++;

      set({
        returnFocus:
          typeof document === 'undefined'
            ? null
            : (document.activeElement as HTMLElement | null),
        isDialogTransactionOpen: true,
        modeDialogTransaction: 'add',
        transactionId: null,
        transaction: {
          ...emptyTransaction,
          ...newTransaction,
        },
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

    loadTransaction: async (id, mode = 'edit') => {
      const returnFocus =
        typeof document === 'undefined'
          ? null
          : (document.activeElement as HTMLElement | null);

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
        transactionId: mode === 'copy' ? null : id,
        returnFocus,
        transaction:
          mode === 'copy'
            ? {
                ...emptyTransaction,
                name: transaction.name,
                note: transaction.note ?? null,
                type: transaction.type,
                amount_cents: transaction.amount_cents,
                reference_date: transaction.reference_date,
                category_id: transaction.category_id,
                payment_id: transaction.payment_id,
                card_id: transaction.card_id ?? null,
                credit_card_invoice_id:
                  transaction.credit_card_invoice_id ?? null,
              }
            : transaction,
        modeDialogTransaction: mode === 'copy' ? 'add' : 'edit',
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
