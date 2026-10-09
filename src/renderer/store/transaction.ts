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
  reset: () => void;
  transactionsLoading: boolean;
  transactionsFailed: boolean;

  init: () => Promise<void>;
  setMonthKey: (monthKey: string) => Promise<void>;
  loadTransactions: () => Promise<void>;
  loadMonthlyStatement: () => Promise<void>;
}

let transactionsRequestId = 0;
let statementRequestId = 0;
let sessionGeneration = 0;

const emptyMonthlyStatement: MonthlyStatementDto = {
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
};

export const useAppStore = create<AppState>((set, get) => ({
  monthKey: currentMonthKey(),
  transactions: [],
  transactionsLoading: false,
  transactionsFailed: false,
  monthlyStatement: emptyMonthlyStatement,

  init: async () => {
    const generation = sessionGeneration;
    const monthKey = get().monthKey;

    try {
      await get().loadTransactions();

      if (generation !== sessionGeneration || get().monthKey !== monthKey) {
        return;
      }

      await get().loadMonthlyStatement();
    } catch (error) {
      console.error('Failed to init app state', error);
    }
  },

  reset: () => {
    sessionGeneration++;
    transactionsRequestId++;
    statementRequestId++;
    set({
      monthKey: currentMonthKey(),
      monthlyStatement: emptyMonthlyStatement,
      transactions: [],
      transactionsLoading: false,
      transactionsFailed: false,
    });
  },

  setMonthKey: async (monthKey) => {
    const generation = sessionGeneration;
    set({ monthKey });

    try {
      await get().loadTransactions();

      if (generation !== sessionGeneration || get().monthKey !== monthKey) {
        return;
      }

      await get().loadMonthlyStatement();
    } catch (error) {
      console.error('Failed to load the selected month', error);
    }
  },

  loadTransactions: async () => {
    const requestId = ++transactionsRequestId;
    set({ transactionsLoading: true, transactionsFailed: false });

    try {
      const { monthKey } = get();
      const transactions = await window.api.getTransactions(monthKey);

      if (get().monthKey === monthKey && requestId === transactionsRequestId) {
        set({ transactions, transactionsLoading: false });
      }
    } catch (error) {
      if (requestId !== transactionsRequestId) {
        return;
      }

      set({ transactionsLoading: false, transactionsFailed: true });
      console.error('Failed to load transactions', error);
      throw error;
    }
  },

  loadMonthlyStatement: async () => {
    if (!window.api.getMonthlyStatement) {
      return;
    }

    const requestId = ++statementRequestId;
    try {
      const { monthKey } = get();
      const statement = await window.api.getMonthlyStatement(monthKey);

      if (get().monthKey === monthKey && requestId === statementRequestId) {
        set({ monthlyStatement: statement });
      }
    } catch (error) {
      if (requestId !== statementRequestId) {
        return;
      }

      console.error('Failed to load monthly statement', error);
    }
  },
}));
