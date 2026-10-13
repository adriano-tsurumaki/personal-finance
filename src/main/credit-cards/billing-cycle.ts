import { getDaysInMonth } from '@shared/lib/calendar';
import type {
  CreditCardInput,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';

export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Adds whole calendar days to a YYYY-MM-DD date, independent of host time zone. */
export function addCalendarDays(value: string, days: number): string {
  if (!validCalendarDate(value) || !Number.isSafeInteger(days)) {
    throw new Error('invalid_card_dates');
  }

  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() < 0 ||
    date.getUTCFullYear() > 9999
  ) {
    throw new Error('invalid_card_dates');
  }

  return date.toISOString().slice(0, 10);
}

export function closingInMonth(month: string, day: number): string {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    throw new Error('invalid_card_dates');
  }

  const [year, index] = month.split('-').map(Number);
  return `${month}-${String(Math.min(day, getDaysInMonth(year, index))).padStart(2, '0')}`;
}

export function adjacentMonth(month: string, offset: number): string {
  return addCalendarDays(
    `${month}-01`,
    offset < 0
      ? -1
      : getDaysInMonth(Number(month.slice(0, 4)), Number(month.slice(5))),
  ).slice(0, 7);
}

export function invoiceEnd(invoice: {
  closing_date: string;
  includes_closing_day: boolean | null;
}): string {
  if (invoice.includes_closing_day === null) {
    throw new Error('unknown_invoice_period');
  }

  return addCalendarDays(
    invoice.closing_date,
    invoice.includes_closing_day ? 0 : -1,
  );
}

export function periodForMonth(
  settings: Omit<CreditCardInput, 'name'>,
  month: string,
): InvoicePeriodDto {
  const closing_date = closingInMonth(month, settings.closing_day);
  const previous = closingInMonth(
    adjacentMonth(month, -1),
    settings.closing_day,
  );
  return {
    opening_date: addCalendarDays(
      previous,
      settings.includes_closing_day ? 1 : 0,
    ),
    closing_date,
    due_date: addCalendarDays(closing_date, settings.due_days_after_closing),
    includes_closing_day: settings.includes_closing_day,
  };
}
