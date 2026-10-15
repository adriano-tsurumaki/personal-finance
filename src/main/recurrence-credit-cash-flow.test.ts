import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RecurrenceSchedule } from '@shared/contracts/recurrence';
import { expandRecurrenceDates } from '@shared/lib/recurrence-calendar';
import {
  addCalendarDays,
  adjacentMonth,
  invoiceEnd,
  periodForMonth,
} from './credit-cards/billing-cycle';
import {
  aggregateCreditRecurrence,
  creditProjectionBoundaries,
} from './recurrence-credit-cash-flow';

const settings = {
  closing_day: 15,
  includes_closing_day: true,
  due_days_after_closing: 10,
};
function due(date: string): string {
  let period = periodForMonth(settings, date.slice(0, 7));

  if (date > invoiceEnd(period)) {
    period = periodForMonth(settings, adjacentMonth(date.slice(0, 7), 1));
  }

  return period.due_date;
}

test('bounded credit aggregation matches enumeration with moved invoice dates and sparse suppressions', () => {
  const invoices = [
    { ...periodForMonth(settings, '2023-04'), due_date: '2024-06-01' },
    { ...periodForMonth(settings, '2024-06'), due_date: '2024-06-29' },
  ];
  const ignored = ['2023-03-16', '2024-06-10'];
  const included = ['2024-06-11'];
  for (const frequency of [1, 2, 3, 4] as const) {
    const schedule: RecurrenceSchedule = {
      anchor_date: '2020-02-29',
      frequency,
      interval: 1,
    };
    const project = (date: string) => {
      if ([...ignored, ...included].includes(date)) {
        return { cash_flow_date: null, issue: null };
      }

      const invoice = invoices.find(
        (row) => row.opening_date <= date && date <= invoiceEnd(row),
      );
      return { cash_flow_date: invoice?.due_date ?? due(date), issue: null };
    };
    let opening = 0;
    const actual = new Map<string, number>();
    aggregateCreditRecurrence({
      schedule,
      from: '2020-02-29',
      to: '2024-07-01',
      start: '2024-06-01',
      end: '2024-07-01',
      criticalDates: [
        ...creditProjectionBoundaries(invoices, settings),
        ...[...ignored, ...included].flatMap((date) => [
          date,
          addCalendarDays(date, 1),
        ]),
      ],
      project,
      add(date, count) {
        if (date < '2024-06-01') {
          opening += count;
        } else {
          actual.set(date, (actual.get(date) ?? 0) + count);
        }
      },
      fail(issue): never {
        throw new Error(issue);
      },
    });
    let expectedOpening = 0;
    const expected = new Map<string, number>();
    for (const date of expandRecurrenceDates(
      schedule,
      '2020-02-29',
      '2024-07-01',
    )) {
      const cashDate = project(date).cash_flow_date;

      if (cashDate && cashDate < '2024-06-01') {
        expectedOpening += 1;
      } else if (cashDate && cashDate < '2024-07-01') {
        expected.set(cashDate, (expected.get(cashDate) ?? 0) + 1);
      }
    }
    assert.equal(opening, expectedOpening);
    assert.deepEqual([...actual].sort(), [...expected].sort());
  }
});

test('millions of historical daily slots use bounded billing callbacks', () => {
  let callbacks = 0;
  let opening = 0;
  aggregateCreditRecurrence({
    schedule: { anchor_date: '0100-01-01', frequency: 1, interval: 1 },
    from: '0100-01-01',
    to: '9998-07-01',
    start: '9998-06-01',
    end: '9998-07-01',
    criticalDates: [],
    project(date) {
      callbacks += 1;
      return { cash_flow_date: due(date), issue: null };
    },
    add(date, count) {
      if (date < '9998-06-01') {
        opening += count;
      }
    },
    fail(issue): never {
      throw new Error(issue);
    },
  });
  assert.ok(opening > 3_000_000);
  assert.ok(callbacks < 150, `${callbacks} callbacks`);
});
