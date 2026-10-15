import type { RecurrenceSchedule } from '../contracts/recurrence';
import { getDaysInMonth } from './calendar';

const dayMilliseconds = 86_400_000;

function parts(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError('Expected a YYYY-MM-DD calendar date.');
  }

  const [year, month, day] = date.split('-').map(Number);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInMonth(year, month)
  ) {
    throw new RangeError('Invalid calendar date.');
  }

  return [year, month, day];
}

function ordinal(date: string): number {
  const [year, month, day] = parts(date);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(0, 0, 0, 0);
  return value.getTime() / dayMilliseconds;
}

function validate(schedule: RecurrenceSchedule): void {
  parts(schedule.anchor_date);

  if (
    ![1, 2, 3, 4].includes(schedule.frequency) ||
    !Number.isSafeInteger(schedule.interval) ||
    schedule.interval < 1
  ) {
    throw new RangeError('Invalid recurrence cadence.');
  }
}

/** Returns an anchored slot, clamping each month independently. */
export function recurrenceDateAt(
  schedule: RecurrenceSchedule,
  index: number,
): string {
  validate(schedule);

  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('Invalid occurrence index.');
  }

  const [year, month, day] = parts(schedule.anchor_date);

  if (schedule.frequency <= 2) {
    const date = new Date(
      (ordinal(schedule.anchor_date) +
        index * schedule.interval * (schedule.frequency === 2 ? 7 : 1)) *
        dayMilliseconds,
    );
    const result = date.toISOString().slice(0, 10);
    parts(result);
    return result;
  }

  const months =
    year * 12 +
    month -
    1 +
    index * schedule.interval * (schedule.frequency === 4 ? 12 : 1);
  const targetYear = Math.floor(months / 12);
  const targetMonth = (months % 12) + 1;

  if (targetYear > 9999) {
    throw new RangeError('Recurrence exceeds the supported calendar.');
  }

  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, getDaysInMonth(targetYear, targetMonth))).padStart(2, '0')}`;
}

/** First slot index on or after the date; O(1), independent of historical age. */
export function recurrenceIndexAtOrAfter(
  schedule: RecurrenceSchedule,
  date: string,
): number {
  validate(schedule);
  const [year, month] = parts(date);

  if (date <= schedule.anchor_date) {
    return 0;
  }

  if (schedule.frequency <= 2) {
    return Math.ceil(
      (ordinal(date) - ordinal(schedule.anchor_date)) /
        (schedule.interval * (schedule.frequency === 2 ? 7 : 1)),
    );
  }

  const [anchorYear, anchorMonth] = parts(schedule.anchor_date);
  const width = schedule.interval * (schedule.frequency === 4 ? 12 : 1);
  const candidate = Math.floor(
    ((year - anchorYear) * 12 + month - anchorMonth) / width,
  );
  return recurrenceDateAt(schedule, candidate) < date
    ? candidate + 1
    : candidate;
}

/** Counts slots in a half-open range without expanding historical occurrences. */
export function countRecurrenceDates(
  schedule: RecurrenceSchedule,
  from: string,
  to: string,
): number {
  parts(from);
  parts(to);

  if (from > to) {
    throw new RangeError('Invalid recurrence range.');
  }

  return (
    recurrenceIndexAtOrAfter(schedule, to) -
    recurrenceIndexAtOrAfter(schedule, from)
  );
}

/** Expands only slots in the requested half-open calendar range. */
export function expandRecurrenceDates(
  schedule: RecurrenceSchedule,
  from: string,
  to: string,
): string[] {
  const count = countRecurrenceDates(schedule, from, to);
  const start = recurrenceIndexAtOrAfter(schedule, from);
  return Array.from({ length: count }, (_, index) =>
    recurrenceDateAt(schedule, start + index),
  );
}

export function isRecurrenceDate(
  schedule: RecurrenceSchedule,
  date: string,
): boolean {
  return (
    recurrenceDateAt(schedule, recurrenceIndexAtOrAfter(schedule, date)) ===
    date
  );
}
