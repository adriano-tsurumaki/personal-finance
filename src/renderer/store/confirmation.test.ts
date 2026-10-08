import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmation, useConfirmationStore } from './confirmation';

test('confirmation resolves once and clears the active request', async () => {
  const result = confirmation.confirm({ title: 'Proceed?' });
  assert.equal(useConfirmationStore.getState().options?.title, 'Proceed?');
  confirmation.respond(true);
  confirmation.respond(false);
  assert.equal(await result, true);
  assert.equal(useConfirmationStore.getState().options, null);
  assert.equal(useConfirmationStore.getState().resolve, null);
});

test('dismissal returns false and allows a later confirmation', async () => {
  const cancelled = confirmation.confirm({ title: 'Cancel this request?' });
  confirmation.respond(false);
  assert.equal(await cancelled, false);

  const next = confirmation.confirm({ title: 'Next request' });
  confirmation.respond(true);
  assert.equal(await next, true);
});

test('overlapping requests cannot replace or confirm the active action', async () => {
  const first = confirmation.confirm({ title: 'First action' });
  const second = confirmation.confirm({ title: 'Second action' });
  assert.equal(await second, false);
  assert.equal(useConfirmationStore.getState().options?.title, 'First action');
  confirmation.respond(true);
  assert.equal(await first, true);
});
