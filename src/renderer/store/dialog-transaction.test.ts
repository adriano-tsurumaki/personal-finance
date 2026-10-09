import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransactionInput } from '@shared/contracts/transaction';
import { createDialogTransactionStore } from './dialog-transaction';

const transaction: TransactionInput = {
  name: 'Original',
  type: 2,
  amount_cents: 100,
  reference_date: '2026-10-08',
  payment_date: null,
  payment_id: 3,
  category_id: 1,
  user_id: 1,
};

function deferred() {
  let resolve!: (value: TransactionInput) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<TransactionInput>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

test('only the latest edit request can populate the dialog', async () => {
  const first = deferred();
  const second = deferred();
  const store = createDialogTransactionStore((id) =>
    id === 1 ? first.promise : second.promise,
  );
  const loadFirst = store.getState().loadTransaction(1);
  const loadSecond = store.getState().loadTransaction(2);
  second.resolve({ ...transaction, name: 'Latest' });
  await loadSecond;
  first.resolve(transaction);
  await loadFirst;
  assert.equal(store.getState().transactionId, 2);
  assert.equal(store.getState().transaction.name, 'Latest');
});

test('opening or closing a form invalidates pending edit responses', async () => {
  for (const action of [
    'openDialogTransaction',
    'closeDialogTransaction',
  ] as const) {
    const pending = deferred();
    const store = createDialogTransactionStore(() => pending.promise);
    const load = store.getState().loadTransaction(1);
    store.getState()[action]();
    pending.resolve(transaction);
    await load;
    assert.equal(store.getState().transactionId, null);
    assert.equal(store.getState().modeDialogTransaction, 'add');
    assert.equal(
      store.getState().isDialogTransactionOpen,
      action === 'openDialogTransaction',
    );
  }
});

test('obsolete load failures do not report errors for a new form', async () => {
  const pending = deferred();
  const store = createDialogTransactionStore(() => pending.promise);
  const load = store.getState().loadTransaction(1);
  store.getState().openDialogTransaction();
  pending.reject(new Error('Old request failed'));
  await assert.doesNotReject(load);
});

test('submission locks the form and a failed save preserves its draft', async () => {
  let calls = 0;
  const store = createDialogTransactionStore(async () => {
    calls++;
    return transaction;
  });
  await store.getState().loadTransaction(1);
  const firstSubmission = store.getState().startSubmission()!;
  assert.ok(firstSubmission);
  assert.equal(store.getState().startSubmission(), null);
  store.getState().openDialogTransaction();
  store.getState().closeDialogTransaction();
  store.getState().resetTransaction();
  store.getState().handleTransaction('name', 'Unexpected');
  await store.getState().loadTransaction(2);
  assert.equal(calls, 1);
  assert.equal(store.getState().transactionId, 1);
  assert.equal(store.getState().transaction.name, 'Original');
  assert.equal(store.getState().isDialogTransactionOpen, true);
  store.getState().finishSubmission(false, firstSubmission);
  assert.equal(store.getState().isSubmitting, false);
  assert.equal(store.getState().transaction.name, 'Original');
  const secondSubmission = store.getState().startSubmission()!;
  assert.ok(secondSubmission);
  store.getState().finishSubmission(true, secondSubmission);
  assert.equal(store.getState().isDialogTransactionOpen, false);
  assert.equal(store.getState().transactionId, null);
  assert.equal(store.getState().transaction.name, '');
});

test('session reset clears drafts and invalidates pending edit successes and failures', async () => {
  for (const failed of [false, true]) {
    const pending = deferred();
    const store = createDialogTransactionStore(() => pending.promise);
    store.getState().openDialogTransaction();
    store.getState().handleTransaction('name', 'Private draft');
    const load = store.getState().loadTransaction(1);
    store.getState().resetSession();

    if (failed) {
      pending.reject(new Error('Previous profile failed'));
    } else {
      pending.resolve(transaction);
    }

    await assert.doesNotReject(load);
    assert.equal(store.getState().isDialogTransactionOpen, false);
    assert.equal(store.getState().transactionId, null);
    assert.equal(store.getState().transaction.name, '');
    assert.equal(store.getState().transaction.user_id, 0);
  }
});

test('a previous session submission cannot unlock or clear the next session form', () => {
  const store = createDialogTransactionStore();
  store.getState().openDialogTransaction();
  store.getState().handleTransaction('name', 'Previous profile');
  const previousSubmission = store.getState().startSubmission()!;
  store.getState().resetSession();
  assert.equal(store.getState().isSubmitting, false);
  assert.equal(store.getState().isCurrentSubmission(previousSubmission), false);
  store.getState().openDialogTransaction();
  store.getState().handleTransaction('name', 'Next profile');
  const currentSubmission = store.getState().startSubmission()!;

  for (const saved of [false, true]) {
    store.getState().finishSubmission(saved, previousSubmission);
    assert.equal(store.getState().transaction.name, 'Next profile');
    assert.equal(store.getState().isSubmitting, true);
    assert.equal(store.getState().isCurrentSubmission(currentSubmission), true);
  }

  store.getState().finishSubmission(true, currentSubmission);
  assert.equal(store.getState().transaction.name, '');
});
