import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { changeIndicatorAnchor } from './indicator-anchor-actions';
import { useAppStore } from '@store/transaction';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const anchor: IndicatorAnchorDto = {
  start_date: '2026-10-10',
  opening_balance_cents: -5000,
};
const originalRefresh = useAppStore.getState().refreshMonth;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  useAppStore.getState().reset();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        indicatorAnchor: {
          save: async () => anchor,
          remove: async () => {},
        },
      },
    },
  });
  useAppStore.setState({ refreshMonth: async () => {} });
});

afterEach(() => {
  useAppStore.getState().reset();
  useAppStore.setState({ refreshMonth: originalRefresh });

  if (descriptor) {
    Object.defineProperty(globalThis, 'window', descriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

test('saving holds the shared lock through persistence and refresh and guards duplicate actions', async () => {
  const persisted = deferred<IndicatorAnchorDto>();
  const refreshed = deferred<void>();
  let writes = 0;
  let published: IndicatorAnchorDto | null = null;
  window.api.indicatorAnchor.save = () => {
    writes++;
    return persisted.promise;
  };
  useAppStore.setState({
    statementLoaded: true,
    refreshMonth: () => refreshed.promise,
  });
  const saving = changeIndicatorAnchor(
    anchor,
    () => true,
    (value) => {
      published = value;
    },
  );
  assert.equal(financialActionsBlocked(), true);
  assert.equal(
    await changeIndicatorAnchor(
      anchor,
      () => true,
      () => {},
    ),
    'blocked',
  );
  persisted.resolve(anchor);
  await Promise.resolve();
  assert.deepEqual(published, anchor);
  assert.equal(useAppStore.getState().statementLoaded, false);
  assert.equal(financialActionsBlocked(), true);
  refreshed.resolve();
  assert.equal(await saving, 'saved');
  assert.equal(writes, 1);
  assert.equal(financialActionsBlocked(), false);
});

test('obsolete saves never publish or refresh another session and cannot release its operation', async () => {
  const persisted = deferred<IndicatorAnchorDto>();
  let active = true;
  let published = false;
  let refreshed = false;
  window.api.indicatorAnchor.save = () => persisted.promise;
  useAppStore.setState({
    refreshMonth: async () => {
      refreshed = true;
    },
  });
  const saving = changeIndicatorAnchor(
    anchor,
    () => active,
    () => {
      published = true;
    },
  );
  active = false;
  useAppStore.getState().reset();
  const release = useFinancialOperations.getState().begin('period');
  persisted.resolve(anchor);
  assert.equal(await saving, 'stale');
  assert.equal(published, false);
  assert.equal(refreshed, false);
  assert.equal(financialActionsBlocked(), true);
  release();
});

test('save errors allow retry and persisted changes survive refresh failure', async () => {
  window.api.indicatorAnchor.save = async () => {
    throw new Error('Write failed');
  };
  assert.equal(
    await changeIndicatorAnchor(
      anchor,
      () => true,
      () => assert.fail('Must not publish'),
    ),
    'error',
  );
  assert.equal(financialActionsBlocked(), false);
  window.api.indicatorAnchor.save = async () => anchor;
  useAppStore.setState({
    refreshMonth: async () => {
      throw new Error('Read failed');
    },
  });
  let published: IndicatorAnchorDto | null = null;
  assert.equal(
    await changeIndicatorAnchor(
      anchor,
      () => true,
      (value) => {
        published = value;
      },
    ),
    'refresh_failed',
  );
  assert.deepEqual(published, anchor);
  assert.deepEqual(useAppStore.getState().indicatorAnchor, anchor);
  assert.equal(financialActionsBlocked(), false);
  useAppStore.setState({ refreshMonth: async () => {} });
  assert.equal(
    await changeIndicatorAnchor(
      anchor,
      () => true,
      () => {},
    ),
    'saved',
  );
});

test('removal refreshes full history and excluded periods are a successful reporting result', async () => {
  let removed = false;
  let published: IndicatorAnchorDto | null = anchor;
  window.api.indicatorAnchor.remove = async () => {
    removed = true;
  };
  useAppStore.setState({
    indicatorAnchor: anchor,
    refreshMonth: async () => {
      useAppStore.setState({
        statementIssue: 'before_indicator_anchor',
        statementLoaded: false,
        statementFailed: false,
      });
    },
  });
  assert.equal(
    await changeIndicatorAnchor(
      null,
      () => true,
      (value) => {
        published = value;
      },
    ),
    'saved',
  );
  assert.equal(removed, true);
  assert.equal(published, null);
  assert.equal(useAppStore.getState().indicatorAnchor, null);
  assert.equal(financialActionsBlocked(), false);
});
