import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAppearanceStore } from './appearance';
import { applyAppearance, connectAppearance } from '@lib/appearance';
import type { AppearanceSnapshot } from '@shared/contracts/appearance';

const initial: AppearanceSnapshot = {
  themeId: 'ledger',
  colorMode: 'system',
  resolvedMode: 'light',
  revision: 0,
};

test('theme switches guard concurrent handlers and ignore stale responses after a system event', async () => {
  let resolve!: (snapshot: AppearanceSnapshot) => void;
  let requests = 0;
  const applied: AppearanceSnapshot[] = [];
  const { store, receive } = createAppearanceStore(
    {
      update: () => {
        requests += 1;
        return new Promise((done) => {
          resolve = done;
        });
      },
    },
    initial,
    (snapshot) => applied.push(snapshot),
  );
  const preference = { themeId: 'graphite', colorMode: 'system' } as const;
  const request = store.getState().update(preference);
  await store.getState().update(preference);
  assert.equal(requests, 1);
  assert.equal(store.getState().pending, true);
  receive({ ...preference, resolvedMode: 'dark', revision: 2 });
  resolve({ ...preference, resolvedMode: 'light', revision: 1 });
  await request;
  assert.equal(store.getState().snapshot.resolvedMode, 'dark');
  assert.equal(applied.length, 1);
  assert.equal(store.getState().pending, false);
});

test('failed saves retain the applied theme, release the guard and allow retry', async () => {
  let fail = true;
  const { store } = createAppearanceStore(
    {
      update: async (preference) => {
        if (fail) {
          throw new Error('Disk unavailable');
        }

        return { ...preference, resolvedMode: 'dark', revision: 1 };
      },
    },
    initial,
    () => {},
  );
  const preference = { themeId: 'graphite', colorMode: 'dark' } as const;
  await store.getState().update(preference);
  assert.deepEqual(store.getState().snapshot, initial);
  assert.equal(store.getState().failed, true);
  assert.equal(store.getState().pending, false);
  fail = false;
  await store.getState().update(preference);
  assert.equal(store.getState().snapshot.themeId, 'graphite');
  assert.equal(store.getState().failed, false);
});

test('subscription catches newer preload state, discards older events and cleans up', () => {
  const seen: number[] = [];
  let listener!: (snapshot: AppearanceSnapshot) => void;
  let disconnected = false;
  const disconnect = connectAppearance(
    {
      initial,
      update: async () => initial,
      onChange: (callback) => {
        listener = callback;
        callback({ ...initial, revision: 2 });
        return () => {
          disconnected = true;
        };
      },
    },
    (snapshot) => seen.push(snapshot.revision),
  );
  listener({ ...initial, revision: 1 });
  listener({ ...initial, revision: 3 });
  assert.deepEqual(seen, [2, 3]);
  disconnect();
  assert.equal(disconnected, true);
});

test('root theme applies outside React and replaces both mode classes on every switch', () => {
  const classes = new Set<string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: { colorScheme: '' },
    classList: {
      toggle: (name: string, enabled: boolean) =>
        enabled ? classes.add(name) : classes.delete(name),
    },
  };
  applyAppearance(
    { ...initial, themeId: 'graphite', resolvedMode: 'dark' },
    root as unknown as HTMLElement,
  );
  assert.equal(root.dataset.theme, 'graphite');
  assert.deepEqual([...classes], ['dark']);
  assert.equal(root.style.colorScheme, 'dark');
  applyAppearance(initial, root as unknown as HTMLElement);
  assert.deepEqual([...classes], ['light']);
  assert.equal(root.dataset.theme, 'ledger');
});
