import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from './financial-operations';

test('operation ownership survives overlapping completions, duplicate releases and session resets', () => {
  useFinancialOperations.getState().reset();
  const first = useFinancialOperations.getState().begin('mutation');
  const second = useFinancialOperations.getState().begin('period');
  first();
  first();
  assert.equal(financialActionsBlocked(), true);
  assert.equal(useFinancialOperations.getState().pending.size, 1);
  useFinancialOperations.getState().reset();
  const current = useFinancialOperations.getState().begin('mutation');
  second();
  assert.equal(financialActionsBlocked(), true);
  current();
  assert.equal(financialActionsBlocked(), false);
});
