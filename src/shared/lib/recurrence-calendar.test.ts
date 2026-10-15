import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countRecurrenceDates,
  expandRecurrenceDates,
  isRecurrenceDate,
  recurrenceDateAt,
} from './recurrence-calendar';
import type { RecurrenceSchedule } from '../contracts/recurrence';

test('monthly dates retain the original anchor across short months', () => {
  const schedule: RecurrenceSchedule = {
    anchor_date: '2024-01-31',
    frequency: 3,
    interval: 1,
  };
  assert.deepEqual(
    expandRecurrenceDates(schedule, '2024-01-01', '2024-05-01'),
    ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30'],
  );
  assert.equal(isRecurrenceDate(schedule, '2024-03-30'), false);
  assert.equal(
    recurrenceDateAt(
      { ...schedule, anchor_date: '2024-02-29', frequency: 4 },
      4,
    ),
    '2028-02-29',
  );
});

test('quarterly, weekly and distant slots are independent of confirmation', () => {
  assert.deepEqual(
    expandRecurrenceDates(
      { anchor_date: '2026-03-12', frequency: 3, interval: 1 },
      '2026-04-01',
      '2026-06-01',
    ),
    ['2026-04-12', '2026-05-12'],
  );
  assert.deepEqual(
    expandRecurrenceDates(
      { anchor_date: '2026-03-12', frequency: 3, interval: 3 },
      '2026-06-01',
      '2026-10-01',
    ),
    ['2026-06-12', '2026-09-12'],
  );
  assert.equal(
    countRecurrenceDates(
      { anchor_date: '0001-01-01', frequency: 1, interval: 1 },
      '9998-01-01',
      '9999-01-01',
    ),
    365,
  );
  assert.equal(
    countRecurrenceDates(
      { anchor_date: '2026-03-02', frequency: 2, interval: 1 },
      '2026-03-01',
      '2026-04-01',
    ),
    5,
  );
});

test('fast range counting matches a reference enumerator across calendar boundaries', () => {
  for (const frequency of [1, 2, 3, 4] as const) {
    for (const interval of [1, 2, 3, 7]) {
      const schedule = { anchor_date: '2020-02-29', frequency, interval };
      const expected: string[] = [];
      for (let index = 0; ; index += 1) {
        const date = recurrenceDateAt(schedule, index);

        if (date >= '2030-01-01') {
          break;
        }

        if (date >= '2024-03-01') {
          expected.push(date);
        }
      }
      assert.deepEqual(
        expandRecurrenceDates(schedule, '2024-03-01', '2030-01-01'),
        expected,
      );
      assert.equal(
        countRecurrenceDates(schedule, '2024-03-01', '2030-01-01'),
        expected.length,
      );
    }
  }
});

test('invalid dates, cadence and reversed ranges fail explicitly', () => {
  const schedule = {
    anchor_date: '2026-01-31',
    frequency: 3 as const,
    interval: 1,
  };
  assert.throws(
    () => expandRecurrenceDates(schedule, '2026-02-30', '2026-04-01'),
    RangeError,
  );
  assert.throws(
    () => countRecurrenceDates(schedule, '2026-04-01', '2026-03-01'),
    RangeError,
  );
  assert.throws(
    () => recurrenceDateAt({ ...schedule, interval: 0 }, 0),
    RangeError,
  );
  assert.throws(() => recurrenceDateAt(schedule, -1), RangeError);
});
