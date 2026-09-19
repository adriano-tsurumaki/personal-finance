import { create } from 'zustand';
import { currentMonthKey } from '@shared/lib/calc';
import type { TransactionDto } from '@shared/contracts/transaction';

interface AppState {
  /**
   * The key of the currently selected month in the format YYYY-MM
   */
  monthKey: string;
  transactions: TransactionDto[];

  init: () => Promise<void>;
  setMonthKey: (monthKey: string) => Promise<void>;
  loadTransactions: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  monthKey: currentMonthKey(),
  transactions: [],

  init: async () => {
    try {
      await get().loadTransactions();
    } catch (error) {
      console.error('Failed to init app state', error);
    }
  },

  setMonthKey: async (monthKey) => {
    set({ monthKey });
    await get().loadTransactions();
  },

  loadTransactions: async () => {
    try {
      const { monthKey } = get();
      const transactions = await window.api.getTransactions(monthKey);
      if (get().monthKey === monthKey) set({ transactions });
    } catch (error) {
      console.error('Failed to load transactions', error);
    }
  },
}));
