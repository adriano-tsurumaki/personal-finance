import type { RecurrenceSchedule } from '@shared/contracts/recurrence';
import {
  recurrenceDateAt,
  recurrenceIndexAtOrAfter,
} from '@shared/lib/recurrence-calendar';
import type { CreditCardInput } from '@shared/contracts/credit-cards';
import {
  addCalendarDays,
  adjacentMonth,
  invoiceEnd,
  periodForMonth,
} from './credit-cards/billing-cycle';

/** Splits exceptional persisted periods from monotone, purely calculated cycles. */
export function creditProjectionBoundaries(
  invoices: {
    opening_date: string | null;
    closing_date: string;
    includes_closing_day: boolean | null;
  }[],
  settings: Omit<CreditCardInput, 'name'>,
): string[] {
  const dates = new Set<string>();
  for (const invoice of invoices) {
    if (invoice.opening_date) {
      dates.add(invoice.opening_date);
    }

    if (invoice.includes_closing_day !== null) {
      dates.add(addCalendarDays(invoiceEnd(invoice), 1));
    }

    for (const month of [
      invoice.closing_date.slice(0, 7),
      adjacentMonth(invoice.closing_date.slice(0, 7), 1),
    ]) {
      const period = periodForMonth(settings, month);
      dates.add(`${month}-01`);
      dates.add(period.opening_date);
      dates.add(addCalendarDays(invoiceEnd(period), 1));
      dates.add(`${adjacentMonth(month, 1)}-01`);
    }
  }
  return [...dates];
}

/**
 * Aggregates historical credit slots by monotone billing segments and sparse
 * exception boundaries. Does not enumerate the historical schedule or months.
 * Callers split every decision/coverage date into a singleton calendar interval.
 */
export function aggregateCreditRecurrence(input: {
  schedule: RecurrenceSchedule;
  from: string;
  to: string;
  start: string;
  end: string;
  criticalDates: string[];
  project(date: string): {
    cash_flow_date: string | null;
    issue: string | null;
  };
  add(date: string, count: number): void;
  fail(issue: string): never;
}): void {
  const cuts = [
    ...new Set([
      input.from,
      input.to,
      ...input.criticalDates.filter(
        (date) => date > input.from && date < input.to,
      ),
    ]),
  ].sort();
  const scheduled = (index: number) => recurrenceDateAt(input.schedule, index);
  const projected = (index: number) => input.project(scheduled(index));

  for (let segment = 0; segment < cuts.length - 1; segment += 1) {
    const first = recurrenceIndexAtOrAfter(input.schedule, cuts[segment]);
    const limit = recurrenceIndexAtOrAfter(input.schedule, cuts[segment + 1]);

    if (first >= limit) {
      continue;
    }

    const firstValue = projected(first);

    if (!firstValue.cash_flow_date) {
      if (firstValue.issue) {
        input.fail(firstValue.issue);
      }

      continue;
    }

    // Within a segment the due-date mapping is nondecreasing. A persisted
    // invoice has a constant due date; regular cycles advance monotonically.
    function lowerBound(target: string): number {
      let low = first;
      let high = limit;
      while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        const value = projected(middle);

        if (!value.cash_flow_date) {
          input.fail(value.issue ?? 'recurrence_ambiguous_invoice');
        }

        if (value.cash_flow_date < target) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }
      return low;
    }
    const end = lowerBound(input.end);

    if (first >= end) {
      continue;
    }

    if (firstValue.issue) {
      input.fail(firstValue.issue);
    }

    const visible = Math.min(end, lowerBound(input.start));

    if (visible > first) {
      input.add(firstValue.cash_flow_date, visible - first);
    }

    let index = visible;
    while (index < end) {
      const value = projected(index);

      if (value.issue || !value.cash_flow_date) {
        input.fail(value.issue ?? 'recurrence_ambiguous_invoice');
      }

      // Group all purchases due on the same day instead of expanding each one.
      const nextDay = addCalendarDays(value.cash_flow_date, 1);
      const next = Math.min(end, lowerBound(nextDay));
      input.add(value.cash_flow_date, next - index);
      index = next;
    }
  }
}
