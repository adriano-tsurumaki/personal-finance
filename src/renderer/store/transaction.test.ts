import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionDto } from '@shared/contracts/transaction';
import { useAppStore } from './transaction';

test('timeline refresh applies the latest response and reports load failures', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const initialState = useAppStore.getState();
  const entry: TransactionDto = {
    id: 1,
    name: 'Saved entry',
    note: null,
    type: 2,
    amount_cents: 100,
    reference_date: '2026-10-08',
    payment_date: null,
    payment_id: 3,
    category: null,
  };
  let resolveOld!: (entries: TransactionDto[]) => void;
  const oldResponse = new Promise<TransactionDto[]>((resolve) => {
    resolveOld = resolve;
  });
  let requests = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        getTransactions: async () => {
          requests++;
          return requests === 1 ? oldResponse : [entry];
        },
      },
    },
  });
  try {
    useAppStore.setState({ monthKey: '2026-10', transactions: [] });
    const oldLoad = useAppStore.getState().loadTransactions();
    await useAppStore.getState().loadTransactions();
    assert.deepEqual(useAppStore.getState().transactions, [entry]);
    resolveOld([]);
    await oldLoad;
    assert.deepEqual(useAppStore.getState().transactions, [entry]);
    const updated = { ...entry, name: 'Updated entry' };
    window.api.getTransactions = async () => [updated];
    await useAppStore.getState().loadTransactions();
    assert.deepEqual(useAppStore.getState().transactions, [updated]);
    const staleResponse = new Promise<TransactionDto[]>((resolve) => {
      resolveOld = resolve;
    });
    window.api.getTransactions = async () => staleResponse;
    const staleLoad = useAppStore.getState().loadTransactions();
    useAppStore.setState({
      monthlyStatement: { ...initialState.monthlyStatement, net: 999 },
    });
    useAppStore.getState().reset();
    resolveOld([updated]);
    await staleLoad;
    assert.deepEqual(useAppStore.getState().transactions, []);
    assert.equal(useAppStore.getState().monthlyStatement.net, 0);
    assert.equal(useAppStore.getState().transactionsLoading, false);
    window.api.getTransactions = async () => {
      throw new Error('Refresh unavailable');
    };
    await assert.rejects(
      useAppStore.getState().loadTransactions(),
      /Refresh unavailable/,
    );
    assert.deepEqual(useAppStore.getState().transactions, []);
  } finally {
    useAppStore.setState(initialState);

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('reset invalidates monthly responses and prevents previous load chains from starting new requests', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const initialState = useAppStore.getState();
  let resolveTimeline!: (entries: TransactionDto[]) => void;
  let resolveStatement!: (
    statement: typeof initialState.monthlyStatement,
  ) => void;
  let statementCalls = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        getTransactions: () =>
          new Promise((resolve) => {
            resolveTimeline = resolve;
          }),
        getMonthlyStatement: () => {
          statementCalls++;
          return new Promise((resolve) => {
            resolveStatement = resolve;
          });
        },
      },
    },
  });

  try {
    for (const action of [
      () => useAppStore.getState().init(),
      () => useAppStore.getState().setMonthKey('2026-10'),
    ]) {
      const loading = action();
      useAppStore.getState().reset();
      resolveTimeline([]);
      await loading;
      assert.equal(statementCalls, 0);
    }

    const loadingStatement = useAppStore.getState().loadMonthlyStatement();
    useAppStore.getState().reset();
    resolveStatement({
      ...initialState.monthlyStatement,
      net: 999,
      balanceSeries: [{ date: '2026-10-08', balance: 999 }],
    });
    await loadingStatement;
    assert.equal(useAppStore.getState().monthlyStatement.net, 0);
    assert.deepEqual(useAppStore.getState().monthlyStatement.balanceSeries, []);
  } finally {
    useAppStore.getState().reset();
    useAppStore.setState(initialState);

    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
