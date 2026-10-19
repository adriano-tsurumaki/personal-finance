import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { MonthlyStatementDto } from '@shared/contracts/monthly-statement';
import type { TransactionDto } from '@shared/contracts/transaction';
import { useAppStore } from './transaction';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from './financial-operations';
import { dialogTransactionStore } from './dialog-transaction';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const entry: TransactionDto = {
  id: 1,
  name: 'Receipt',
  note: null,
  type: 1,
  amount_cents: 10000,
  reference_date: '2026-11-01',
  payment_date: null,
  payment_id: 1,
  category: null,
};
const statement: MonthlyStatementDto = {
  year: 2026,
  month: 11,
  income: 100,
  expense: 0,
  net: 100,
  savingsRate: 1,
  openingBalance: 50,
  closingBalance: 150,
  balanceSeries: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}
beforeEach(() => {
  useAppStore.getState().reset();
  dialogTransactionStore.getState().resetSession();
  useAppStore.setState({ monthKey: '2026-10' });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        getTransactions: async () => [entry],
        getMonthlyStatement: async () => statement,
      },
    },
  });
});
afterEach(() => {
  useAppStore.getState().reset();
  dialogTransactionStore.getState().resetSession();

  if (descriptor) {
    Object.defineProperty(globalThis, 'window', descriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
test('navigation publishes the month, timeline and summary together and blocks conflicting actions', async () => {
  const next = deferred<MonthlyStatementDto>();
  window.api.getMonthlyStatement = () => next.promise;
  const previous = { ...statement, month: 10, closingBalance: 50 };
  useAppStore.setState({ monthlyStatement: previous, statementLoaded: true });
  const navigation = useAppStore.getState().setMonthKey('2026-11');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(useAppStore.getState().monthKey, '2026-10');
  assert.deepEqual(useAppStore.getState().transactions, []);
  assert.equal(useAppStore.getState().monthlyStatement, previous);
  assert.equal(useAppStore.getState().statementLoaded, true);
  assert.equal(useAppStore.getState().pendingMonth, '2026-11');
  assert.equal(financialActionsBlocked(), true);
  await useAppStore.getState().setMonthKey('2026-12');
  dialogTransactionStore.getState().openDialogTransaction();
  assert.equal(
    dialogTransactionStore.getState().isDialogTransactionOpen,
    false,
  );
  assert.equal(dialogTransactionStore.getState().startSubmission(), null);
  next.resolve(statement);
  await navigation;
  assert.equal(useAppStore.getState().monthKey, '2026-11');
  assert.deepEqual(useAppStore.getState().transactions, [entry]);
  assert.equal(useAppStore.getState().monthlyStatement, statement);
  assert.equal(useAppStore.getState().statementLoading, false);
  assert.equal(financialActionsBlocked(), false);
});

test('excluded months publish history and anchor metadata without a load failure', async () => {
  const indicator_anchor = {
    start_date: '2026-12-10',
    opening_balance_cents: 50000,
  };
  window.api.getFinancialMonth = async () => ({
    transactions: [entry],
    statement: null,
    statement_issue: 'before_indicator_anchor',
    indicator_anchor,
    recurrences: {
      month: '2026-11',
      occurrences: [],
      unconfirmed_count: 0,
      paused_rules: [],
    },
  });
  await useAppStore.getState().setMonthKey('2026-11');
  const state = useAppStore.getState();
  assert.equal(state.monthKey, '2026-11');
  assert.equal(state.statementLoaded, false);
  assert.equal(state.statementFailed, false);
  assert.equal(state.transactionsFailed, false);
  assert.equal(state.failedMonth, null);
  assert.equal(state.statementIssue, 'before_indicator_anchor');
  assert.deepEqual(state.indicatorAnchor, indicator_anchor);
  assert.deepEqual(state.transactions, [entry]);
  useAppStore.getState().reset();
  assert.equal(useAppStore.getState().indicatorAnchor, null);
  assert.equal(useAppStore.getState().statementIssue, null);
});
test('failure of either request preserves the confirmed period and allows a successful retry', async () => {
  for (const failing of ['getTransactions', 'getMonthlyStatement'] as const) {
    const original = window.api[failing];
    const previous = { ...statement, month: 10, closingBalance: 50 };
    useAppStore.setState({
      monthKey: '2026-10',
      transactions: [],
      monthlyStatement: previous,
      statementLoaded: true,
    });
    window.api[failing] = async () => {
      throw new Error('Unavailable');
    };
    await useAppStore.getState().setMonthKey('2026-11');
    assert.equal(useAppStore.getState().monthKey, '2026-10');
    assert.equal(useAppStore.getState().monthlyStatement, previous);
    assert.deepEqual(useAppStore.getState().transactions, []);
    assert.equal(useAppStore.getState().statementLoaded, true);
    assert.equal(useAppStore.getState().failedMonth, '2026-11');
    assert.equal(financialActionsBlocked(), false);
    Object.assign(window.api, { [failing]: original });
    await useAppStore.getState().setMonthKey('2026-11');
    assert.equal(useAppStore.getState().monthKey, '2026-11');
    assert.equal(useAppStore.getState().failedMonth, null);
  }
});
test('initial failure and failed refresh mark amounts unavailable instead of valid zero or stale results', async () => {
  window.api.getMonthlyStatement = async () => {
    throw new Error('Unavailable');
  };
  await useAppStore.getState().init();
  assert.equal(useAppStore.getState().statementLoaded, false);
  assert.equal(useAppStore.getState().statementFailed, true);
  assert.equal(useAppStore.getState().transactionsFailed, true);
  assert.equal(financialActionsBlocked(), false);
  window.api.getMonthlyStatement = async () => statement;
  await useAppStore.getState().refreshMonth();
  assert.equal(useAppStore.getState().statementLoaded, true);
  window.api.getMonthlyStatement = async () => {
    throw new Error('Refresh failed');
  };
  await useAppStore.getState().refreshMonth();
  assert.equal(useAppStore.getState().statementLoaded, false);
  assert.equal(useAppStore.getState().statementFailed, true);
});
test('a rejected request keeps interactions locked until its companion request settles', async () => {
  const timeline = deferred<TransactionDto[]>();
  window.api.getTransactions = () => timeline.promise;
  window.api.getMonthlyStatement = async () => {
    throw new Error('Unavailable');
  };
  const loading = useAppStore.getState().init();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(financialActionsBlocked(), true);
  timeline.resolve([]);
  await loading;
  assert.equal(financialActionsBlocked(), false);
  assert.equal(useAppStore.getState().statementLoading, false);
});
test('session reset rejects delayed results without releasing a new session operation', async () => {
  const old = deferred<MonthlyStatementDto>();
  window.api.getMonthlyStatement = () => old.promise;
  const loading = useAppStore.getState().init();
  await Promise.resolve();
  useAppStore.getState().reset();
  const release = useFinancialOperations.getState().begin('mutation');
  old.resolve(statement);
  await loading;
  assert.equal(useAppStore.getState().statementLoaded, false);
  assert.equal(useAppStore.getState().monthlyStatement.closingBalance, 0);
  assert.equal(financialActionsBlocked(), true);
  release();
  assert.equal(financialActionsBlocked(), false);
});
test('overlapping refreshes publish only the newest response and release independent tokens', async () => {
  const old = deferred<MonthlyStatementDto>();
  window.api.getMonthlyStatement = () => old.promise;
  const loading = useAppStore.getState().refreshMonth();
  await Promise.resolve();
  window.api.getMonthlyStatement = async () => statement;
  await useAppStore.getState().refreshMonth();
  assert.equal(useAppStore.getState().monthlyStatement, statement);
  assert.equal(financialActionsBlocked(), true);
  old.resolve({ ...statement, closingBalance: 999 });
  await loading;
  assert.equal(useAppStore.getState().monthlyStatement, statement);
  assert.equal(financialActionsBlocked(), false);
});
test('a mutation blocks navigation while its own coordinated refresh can complete', async () => {
  const release = useFinancialOperations.getState().begin('mutation');
  await useAppStore.getState().setMonthKey('2026-11');
  assert.equal(useAppStore.getState().pendingMonth, null);
  await useAppStore.getState().refreshMonth();
  assert.equal(useAppStore.getState().statementLoaded, true);
  assert.equal(financialActionsBlocked(), true);
  release();
  assert.equal(financialActionsBlocked(), false);
});
test('timeline-only refresh ignores obsolete results and releases locks after failures', async () => {
  const old = deferred<TransactionDto[]>();
  window.api.getTransactions = () => old.promise;
  const loading = useAppStore.getState().loadTransactions();
  window.api.getTransactions = async () => [entry];
  await useAppStore.getState().loadTransactions();
  assert.deepEqual(useAppStore.getState().transactions, [entry]);
  old.resolve([]);
  await loading;
  assert.deepEqual(useAppStore.getState().transactions, [entry]);
  assert.equal(financialActionsBlocked(), false);
  window.api.getTransactions = async () => {
    throw new Error('Unavailable');
  };
  await assert.rejects(
    useAppStore.getState().loadTransactions(),
    /Unavailable/,
  );
  assert.equal(useAppStore.getState().transactionsFailed, true);
  assert.equal(financialActionsBlocked(), false);
});

test('combined financial snapshot publishes projections while unknown invoice coverage keeps summary unavailable', async () => {
  const recurrences = {
    month: '2026-11',
    occurrences: [],
    paused_rules: [],
    unconfirmed_count: 1,
  };
  window.api.getFinancialMonth = async () => ({
    transactions: [entry],
    statement: null,
    statement_issue: 'coverage_unknown',
    recurrences,
  });
  await useAppStore.getState().setMonthKey('2026-11');
  const state = useAppStore.getState();
  assert.equal(state.monthKey, '2026-11');
  assert.deepEqual(state.transactions, [entry]);
  assert.equal(state.recurrenceMonth, recurrences);
  assert.equal(state.transactionsFailed, false);
  assert.equal(state.statementLoaded, false);
  assert.equal(state.statementFailed, true);
  assert.equal(financialActionsBlocked(), false);
  window.api.getFinancialMonth = async () => ({
    transactions: [entry],
    statement,
    statement_issue: null,
    recurrences,
  });
  await state.refreshMonth();
  assert.equal(useAppStore.getState().statementLoaded, true);
  assert.equal(useAppStore.getState().statementFailed, false);
});

test('stale combined snapshot cannot publish another profile recurrence data or unlock newer operations', async () => {
  const response =
    deferred<Awaited<ReturnType<typeof window.api.getFinancialMonth>>>();
  window.api.getFinancialMonth = () => response.promise;
  const loading = useAppStore.getState().setMonthKey('2026-11');
  useAppStore.getState().reset();
  const releaseNew = useFinancialOperations.getState().begin('mutation');
  response.resolve({
    transactions: [entry],
    statement,
    statement_issue: null,
    recurrences: {
      month: '2026-11',
      occurrences: [],
      paused_rules: [],
      unconfirmed_count: 5,
    },
  });
  await loading;
  assert.equal(useAppStore.getState().recurrenceMonth, null);
  assert.deepEqual(useAppStore.getState().transactions, []);
  assert.equal(financialActionsBlocked(), true);
  releaseNew();
  assert.equal(financialActionsBlocked(), false);
});

test('combined snapshot transport failure preserves the confirmed period and recurrence association', async () => {
  const previous = {
    month: '2026-10',
    occurrences: [],
    paused_rules: [],
    unconfirmed_count: 2,
  };
  useAppStore.setState({ statementLoaded: true, recurrenceMonth: previous });
  window.api.getFinancialMonth = async () => {
    throw new Error('Database unavailable');
  };
  await useAppStore.getState().setMonthKey('2026-11');
  assert.equal(useAppStore.getState().monthKey, '2026-10');
  assert.equal(useAppStore.getState().recurrenceMonth, previous);
  assert.equal(useAppStore.getState().failedMonth, '2026-11');
  assert.equal(financialActionsBlocked(), false);
});
