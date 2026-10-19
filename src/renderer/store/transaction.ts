import { create } from 'zustand';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from './financial-operations';
import { currentMonthKey } from '@shared/lib/calc';
import type { MonthlyStatementDto } from '@shared/contracts/monthly-statement';
import type { RecurrenceMonthDto } from '@shared/contracts/recurrence';
import type { TransactionDto } from '@shared/contracts/transaction';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';
import type { InvoicePaymentDto } from '@shared/contracts/credit-cards';

interface AppState {
  invoicePayments: InvoicePaymentDto[];
  indicatorAnchor: IndicatorAnchorDto | null;
  statementIssue: string | null;
  /**
   * The key of the currently selected month in the format YYYY-MM
   */
  monthKey: string;
  transactions: TransactionDto[];
  recurrenceMonth: RecurrenceMonthDto | null;
  monthlyStatement: MonthlyStatementDto;
  statementLoading: boolean;
  statementFailed: boolean;
  statementLoaded: boolean;
  transactionsLoading: boolean;
  transactionsFailed: boolean;
  pendingMonth: string | null;
  failedMonth: string | null;

  reset: () => void;
  init: () => Promise<void>;
  refreshMonth: () => Promise<void>;
  setMonthKey: (monthKey: string) => Promise<void>;
  loadTransactions: () => Promise<void>;
}

let transactionsRequestId = 0;
let statementRequestId = 0;
let sessionGeneration = 0;

const emptyMonthlyStatement: MonthlyStatementDto = {
  expense: 0,
  income: 0,
  net: 0,
  savingsRate: 0,
  balanceSeries: [],
  closingBalance: 0,
  openingBalance: 0,
  year: Number(currentMonthKey().slice(0, 4)),
  month: Number(currentMonthKey().slice(5, 7)),
};

export const useAppStore = create<AppState>((set, get) => {
  async function loadPeriod(monthKey: string, navigation: boolean) {
    const generation = sessionGeneration;
    const timelineRequest = ++transactionsRequestId;
    const summaryRequest = ++statementRequestId;
    const release = useFinancialOperations.getState().begin('period');
    set({
      pendingMonth: monthKey,
      failedMonth: null,
      statementLoading: true,
      transactionsLoading: true,
    });

    try {
      const combined = window.api.getFinancialMonth
        ? await window.api.getFinancialMonth(monthKey)
        : null;
      const [timeline, summary] = await Promise.allSettled([
        (async () =>
          combined
            ? combined.transactions
            : window.api.getTransactions(monthKey))(),
        (async () =>
          combined
            ? combined.statement
            : window.api.getMonthlyStatement(monthKey))(),
      ]);

      if (
        generation !== sessionGeneration ||
        timelineRequest !== transactionsRequestId ||
        summaryRequest !== statementRequestId
      ) {
        return;
      }

      if (timeline.status === 'rejected' || summary.status === 'rejected') {
        set({
          pendingMonth: null,
          failedMonth: monthKey,
          statementLoading: false,
          transactionsLoading: false,
          ...(!navigation || !get().statementLoaded
            ? {
                statementLoaded: false,
                statementFailed: true,
                transactionsFailed: true,
              }
            : {}),
        });
        return;
      }

      set({
        monthKey,
        indicatorAnchor: combined?.indicator_anchor ?? null,
        statementIssue: combined?.statement_issue ?? null,
        transactions: timeline.value,
        invoicePayments: combined?.invoice_payments ?? [],
        monthlyStatement: summary.value ?? get().monthlyStatement,
        recurrenceMonth: combined?.recurrences ?? null,
        pendingMonth: null,
        failedMonth: null,
        statementLoading: false,
        statementFailed:
          summary.value === null &&
          combined?.statement_issue !== 'before_indicator_anchor',
        statementLoaded: summary.value !== null,
        transactionsLoading: false,
        transactionsFailed: false,
      });
    } catch {
      if (
        generation === sessionGeneration &&
        timelineRequest === transactionsRequestId &&
        summaryRequest === statementRequestId
      ) {
        set({
          pendingMonth: null,
          failedMonth: monthKey,
          statementLoading: false,
          transactionsLoading: false,
          ...(!navigation || !get().statementLoaded
            ? {
                statementLoaded: false,
                statementFailed: true,
                transactionsFailed: true,
                recurrenceMonth: null,
              }
            : {}),
        });
      }
    } finally {
      release();
    }
  }

  return {
    indicatorAnchor: null,
    statementIssue: null,
    monthKey: currentMonthKey(),
    recurrenceMonth: null,
    transactions: [],
    invoicePayments: [],
    transactionsLoading: false,
    transactionsFailed: false,
    monthlyStatement: emptyMonthlyStatement,
    statementLoading: false,
    statementFailed: false,
    statementLoaded: false,
    pendingMonth: null,
    failedMonth: null,

    init: async () => {
      if (financialActionsBlocked()) {
        return;
      }

      await loadPeriod(get().monthKey, false);
    },
    refreshMonth: () => loadPeriod(get().monthKey, false),

    reset: () => {
      sessionGeneration++;
      useFinancialOperations.getState().reset();
      transactionsRequestId++;
      statementRequestId++;
      set({
        indicatorAnchor: null,
        statementIssue: null,
        monthKey: currentMonthKey(),
        monthlyStatement: emptyMonthlyStatement,
        statementLoading: false,
        statementFailed: false,
        statementLoaded: false,
        pendingMonth: null,
        failedMonth: null,
        recurrenceMonth: null,
        transactions: [],
        invoicePayments: [],
        transactionsLoading: false,
        transactionsFailed: false,
      });
    },

    setMonthKey: async (monthKey) => {
      if (financialActionsBlocked()) {
        return;
      }

      await loadPeriod(monthKey, true);
    },

    loadTransactions: async () => {
      if (get().pendingMonth !== null) {
        return;
      }

      const release = useFinancialOperations.getState().begin('period');
      const requestId = ++transactionsRequestId;
      set({ transactionsLoading: true, transactionsFailed: false });

      try {
        const { monthKey } = get();
        const transactions = await window.api.getTransactions(monthKey);

        if (
          get().monthKey === monthKey &&
          requestId === transactionsRequestId
        ) {
          set({ transactions, transactionsLoading: false });
        }
      } catch (error) {
        if (requestId !== transactionsRequestId) {
          return;
        }

        set({ transactionsLoading: false, transactionsFailed: true });
        console.error('Failed to load transactions', error);
        throw error;
      } finally {
        release();
      }
    },
  };
});
