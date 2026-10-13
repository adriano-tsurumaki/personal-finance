import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDaysInMonth } from './calendar';

test('Gregorian month lengths cover short months and century leap years', () => {
  assert.deepEqual(
    Array.from({ length: 12 }, (_, index) => getDaysInMonth(2026, index + 1)),
    [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  );
  assert.equal(getDaysInMonth(2028, 2), 29);
  assert.equal(getDaysInMonth(1900, 2), 28);
  assert.equal(getDaysInMonth(2000, 2), 29);
  assert.equal(getDaysInMonth(2100, 2), 28);
  assert.equal(getDaysInMonth(0, 2), 29);
  assert.equal(getDaysInMonth(99, 2), 28);
});

test('calendar inputs reject invalid years and months rather than rolling over', () => {
  for (const [year, month] of [
    [-1, 2],
    [2026.5, 2],
    [NaN, 2],
    [Infinity, 2],
    [Number.MAX_SAFE_INTEGER + 1, 2],
    [2026, 0],
    [2026, 13],
    [2026, 2.5],
    [2026, NaN],
  ]) {
    assert.throws(() => getDaysInMonth(year, month), RangeError);
  }
});
