import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redistributeInstallmentAmounts } from './allocation';

test('editing first or last amounts redistributes the remainder exactly and preserves locked positions', () => {
  const amounts = [3334, 3333, 3333];
  assert.deepEqual(
    redistributeInstallmentAmounts(
      10000,
      amounts,
      [false, false, false],
      0,
      3000,
    ),
    [3000, 3500, 3500],
  );
  assert.deepEqual(
    redistributeInstallmentAmounts(
      10000,
      amounts,
      [false, false, false],
      2,
      3001,
    ),
    [3500, 3499, 3001],
  );
  assert.deepEqual(
    redistributeInstallmentAmounts(
      10000,
      [3000, 3500, 3500],
      [true, false, false],
      2,
      3200,
    ),
    [3000, 3800, 3200],
  );
  assert.deepEqual(
    redistributeInstallmentAmounts(
      10000,
      [3000, 3500, 3500],
      [true, false, false],
      0,
      3200,
    ),
    [3200, 3400, 3400],
  );
  assert.deepEqual(amounts, [3334, 3333, 3333]);
});

test('locks cannot hide an invalid total, zero-cent remainder, fractional amount or overflow', () => {
  assert.throws(() =>
    redistributeInstallmentAmounts(
      10000,
      [3000, 3500, 3500],
      [true, true, true],
      0,
      3001,
    ),
  );
  assert.deepEqual(
    redistributeInstallmentAmounts(
      10000,
      [3000, 3500, 3500],
      [true, true, true],
      0,
      3000,
    ),
    [3000, 3500, 3500],
  );
  for (const amount of [
    0,
    -1,
    9999,
    10001,
    20.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() =>
      redistributeInstallmentAmounts(
        10000,
        [3334, 3333, 3333],
        [false, false, false],
        0,
        amount,
      ),
    );
  }

  const total = Number.MAX_SAFE_INTEGER;
  const next = redistributeInstallmentAmounts(
    total,
    [1, 1, 1],
    [false, false, false],
    0,
    1,
  );
  assert.equal(
    next.reduce((sum, amount) => sum + BigInt(amount), 0n),
    BigInt(total),
  );
});
