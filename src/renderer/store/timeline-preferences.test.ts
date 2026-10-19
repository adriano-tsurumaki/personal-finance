import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimelinePreferences } from './timeline-preferences';

test('timeline order survives store recreation and can be changed back', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const first = createTimelinePreferences(storage);
  assert.equal(first.getState().newestFirst, false);
  first.getState().toggleDateOrder();
  const reopened = createTimelinePreferences(storage);
  assert.equal(reopened.getState().newestFirst, true);
  reopened.getState().toggleDateOrder();
  assert.equal(
    createTimelinePreferences(storage).getState().newestFirst,
    false,
  );
});

test('unavailable storage keeps ordering usable and invalid preferences use the default', () => {
  const invalid = createTimelinePreferences({
    getItem: () => 'invalid',
    setItem: () => {},
  });
  assert.equal(invalid.getState().newestFirst, false);
  const unavailable = createTimelinePreferences({
    getItem: () => {
      throw new Error('Read denied');
    },
    setItem: () => {
      throw new Error('Write denied');
    },
  });
  assert.equal(unavailable.getState().newestFirst, false);
  unavailable.getState().toggleDateOrder();
  assert.equal(unavailable.getState().newestFirst, true);
});
