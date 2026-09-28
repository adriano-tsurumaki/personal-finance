import { create } from 'zustand';
import { currentMonthKey } from '@shared/lib/calc';
import type { MonthlyStatementDto } from '@shared/contracts/monthly-statement';
import type { TransactionDto } from '@shared/contracts/transaction';

interface AppState {
  /**
   * The key of the currently selected month in the format YYYY-MM
   */
  monthKey: string;
  transactions: TransactionDto[];
  monthlyStatement: MonthlyStatementDto;

  init: () => Promise<void>;
  setMonthKey: (monthKey: string) => Promise<void>;
  loadTransactions: () => Promise<void>;
  loadMonthlyStatement: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  monthKey: currentMonthKey(),
  transactions: [],
  monthlyStatement: {
    id: 0,
    expense: 0,
    income: 0,
    net: 0,
    savingsRate: 0,
    transactionCount: 0,
    balanceSeries: [],
    closingBalance: 0,
    openingBalance: 0,
    year: Number(currentMonthKey().slice(0, 4)),
    month: Number(currentMonthKey().slice(5, 7)),
  },

  init: async () => {
    try {
      await get().loadTransactions();
      await get().loadMonthlyStatement();
    } catch (error) {
      console.error('Failed to init app state', error);
    }
  },

  setMonthKey: async (monthKey) => {
    set({ monthKey });
    await get().loadTransactions();
    await get().loadMonthlyStatement();
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

  loadMonthlyStatement: async () => {
    try {
      const { monthKey } = get();
      const statement = await window.api.getMonthlyStatement(monthKey);
      set({ monthlyStatement: statement });
    } catch (error) {
      console.error('Failed to load monthly statement', error);
    }
  },
}));
