import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { performRecurrenceMutation } from './mutation';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => useFinancialOperations.getState().reset());

test('recurrence mutation blocks competing actions and owns its lock through financial and forecast refresh', async () => {
  const refresh = deferred<boolean>();
  let saved = false;
  let writes = 0;
  const pending = performRecurrenceMutation({
    current: () => true,
    persist: async () => {
      writes++;
      return { ok: true, value: 12 };
    },
    onSaved: () => {
      saved = true;
    },
    refresh: () => refresh.promise,
  });
  await Promise.resolve();
  assert.equal(saved, true);
  assert.equal(financialActionsBlocked(), true);
  const overlap = await performRecurrenceMutation({
    current: () => true,
    persist: async () => {
      writes++;
      return { ok: true, value: 13 };
    },
    onSaved: () => {},
    refresh: async () => true,
  });
  assert.equal(overlap.status, 'blocked');
  assert.equal(writes, 1);
  refresh.resolve(true);
  assert.equal((await pending).status, 'saved');
  assert.equal(financialActionsBlocked(), false);
});

test('successful confirmation followed by failed refresh stays saved and never repeats persistence', async () => {
  let writes = 0;
  let closed = false;
  const result = await performRecurrenceMutation({
    current: () => true,
    persist: async () => {
      writes++;
      return { ok: true, value: 1 };
    },
    onSaved: () => {
      closed = true;
    },
    refresh: async () => false,
  });
  assert.equal(result.status, 'refresh_failed');
  assert.equal(closed, true);
  assert.equal(writes, 1);
  assert.equal(financialActionsBlocked(), false);
});

test('profile reset rejects old confirmation responses without releasing a newer mutation', async () => {
  const response = deferred<{ ok: true; value: number }>();
  let current = true;
  let published = 0;
  const pending = performRecurrenceMutation({
    current: () => current,
    persist: () => response.promise,
    onSaved: () => {
      published++;
    },
    refresh: async () => {
      published++;
      return true;
    },
  });
  current = false;
  useFinancialOperations.getState().reset();
  const releaseNew = useFinancialOperations.getState().begin('mutation');
  response.resolve({ ok: true, value: 1 });
  assert.equal((await pending).status, 'stale');
  assert.equal(published, 0);
  assert.equal(financialActionsBlocked(), true);
  releaseNew();
});

test('cancelled card correction produces no saved state, refresh, or error outcome', async () => {
  let published = false;
  const result = await performRecurrenceMutation({
    current: () => true,
    persist: async () => ({
      ok: false,
      error: { code: 'conflict', message: 'Cancelled' },
    }),
    onSaved: () => {
      published = true;
    },
    refresh: async () => {
      published = true;
      return true;
    },
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(published, false);
  assert.equal(financialActionsBlocked(), false);
});

test('failed persistence releases only its operation and does not close the editable form', async () => {
  let closed = false;
  const result = await performRecurrenceMutation({
    current: () => true,
    persist: async () => {
      throw new Error('conflict');
    },
    onSaved: () => {
      closed = true;
    },
    refresh: async () => true,
  });
  assert.deepEqual(result, { status: 'error', code: 'conflict' });
  assert.equal(closed, false);
  assert.equal(financialActionsBlocked(), false);
});
