import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { Toast } from '@base-ui/react/toast';
import { setLocale } from '@lib/i18n';
import { useAppStore } from '@store/transaction';
import { watchMonthlyStatementFeedback } from './monthly-statement-feedback';

type Notification = Parameters<
  ReturnType<typeof Toast.useToastManager>['add']
>[0];

function notifications() {
  const active = new Map<string, Notification>();
  const history: Notification[] = [];
  let nextId = 0;
  return {
    active,
    history,
    add(options: Notification) {
      const id = `feedback-${++nextId}`;
      active.set(id, options);
      history.push(options);
      return id;
    },
    close(id?: string) {
      assert.ok(id, 'Feature cleanup must target its own notification.');
      active.delete(id);
    },
  };
}

beforeEach(() => {
  useAppStore.getState().reset();
  setLocale('en-US');
});

test('periods excluded by an anchor do not produce retry error notifications', () => {
  useAppStore.setState({
    statementLoaded: false,
    statementFailed: false,
    statementIssue: 'before_indicator_anchor',
  });
  const manager = notifications();
  const cleanup = watchMonthlyStatementFeedback(manager);
  assert.equal(manager.history.length, 0);
  cleanup();
});

afterEach(() => {
  useAppStore.getState().reset();
  setLocale('pt-BR');
});

test('loading persists without manual dismissal and disappears on completion without success feedback', () => {
  const manager = notifications();
  manager.active.set('unrelated', { title: 'Unrelated message' });
  const stop = watchMonthlyStatementFeedback(manager);
  useAppStore.setState({ statementLoading: true, pendingMonth: '2026-11' });
  const loading = manager.history[0];
  assert.equal(loading.type, 'loading');
  assert.equal(loading.timeout, 0);
  assert.equal(loading.title, 'Loading 2026-11…');
  assert.deepEqual(loading.data, { dismissible: false, instantDismiss: true });
  assert.equal(loading.actionProps, undefined);
  useAppStore.setState({ transactionsLoading: false });
  assert.equal(manager.history.length, 1);
  useAppStore.setState({ statementLoading: false, pendingMonth: null });
  assert.deepEqual([...manager.active.keys()], ['unrelated']);
  assert.equal(manager.history.length, 1);
  stop();
  assert.equal(manager.active.size, 1);
});

test('failure replaces loading with a dismissible error and retry uses the failed target', () => {
  const manager = notifications();
  const retryMonths: string[] = [];
  const original = useAppStore.getState().setMonthKey;
  useAppStore.setState({
    setMonthKey: async (month) => {
      retryMonths.push(month);
    },
  });
  const stop = watchMonthlyStatementFeedback(manager);

  try {
    useAppStore.setState({ statementLoading: true, pendingMonth: '2026-11' });
    useAppStore.setState({
      statementLoading: false,
      pendingMonth: null,
      failedMonth: '2026-11',
    });
    assert.equal(manager.active.size, 1);
    const error = manager.history[1];
    assert.equal(error.type, 'error');
    assert.equal(error.timeout, 0);
    assert.deepEqual(error.data, { dismissible: true, instantDismiss: true });
    assert.equal(error.actionProps?.children, 'Try again');
    error.actionProps?.onClick?.({} as never);
    assert.deepEqual(retryMonths, ['2026-11']);
    // Dismissing an error does not resurface it on an unrelated state update.
    manager.close([...manager.active.keys()][0]);
    useAppStore.setState({ transactionsLoading: false });
    assert.equal(manager.active.size, 0);
    useAppStore.setState({
      statementLoading: true,
      pendingMonth: '2026-11',
      failedMonth: null,
    });
    assert.equal(manager.active.size, 1);
    assert.equal(manager.history.at(-1)?.type, 'loading');
  } finally {
    stop();
    useAppStore.setState({ setMonthKey: original });
  }
  assert.equal(manager.active.size, 0);
});

test('initial failures, target changes and session reset clean up only owned feedback', () => {
  const manager = notifications();
  useAppStore.setState({ statementFailed: true });
  const stop = watchMonthlyStatementFeedback(manager);
  assert.equal(manager.history[0].type, 'error');
  useAppStore.setState({ statementLoading: true, pendingMonth: '2026-11' });
  useAppStore.setState({ pendingMonth: '2026-12' });
  assert.equal(manager.active.size, 1);
  assert.equal(manager.history.at(-1)?.title, 'Loading 2026-12…');
  useAppStore.getState().reset();
  assert.equal(manager.active.size, 0);
  stop();
  useAppStore.setState({ statementLoading: true, pendingMonth: '2027-01' });
  assert.equal(manager.active.size, 0);
});
