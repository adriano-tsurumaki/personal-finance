import { create } from 'zustand';

type FinancialOperation = 'period' | 'mutation' | 'transaction-details';

interface FinancialOperationsState {
  pending: ReadonlyMap<symbol, FinancialOperation>;
  begin: (operation: FinancialOperation) => () => void;
  reset: () => void;
}

/** Each owner releases its own token; stale completions cannot release newer work. */
export const useFinancialOperations = create<FinancialOperationsState>(
  (set) => ({
    pending: new Map(),
    begin: (operation) => {
      const token = Symbol(operation);
      set((state) => ({
        pending: new Map(state.pending).set(token, operation),
      }));
      return () => {
        set((state) => {
          const pending = new Map(state.pending);
          pending.delete(token);
          return { pending };
        });
      };
    },
    reset: () => set({ pending: new Map() }),
  }),
);

export function financialActionsBlocked(): boolean {
  return useFinancialOperations.getState().pending.size > 0;
}
