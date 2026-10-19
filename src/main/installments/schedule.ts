import { getDaysInMonth } from '@shared/lib/calendar';
import { validCalendarDate } from '../credit-cards/billing-cycle';

/** Returns a monthly anchored date; index is zero-based, dates are YYYY-MM-DD. */
export function installmentDateAt(anchor: string, index: number): string {
  if (!validCalendarDate(anchor) || !Number.isSafeInteger(index) || index < 0) {
    throw new Error('invalid_installment');
  }

  const [year, month, day] = anchor.split('-').map(Number);
  const offset = year * 12 + month - 1 + index;
  const targetYear = Math.floor(offset / 12);
  const targetMonth = (offset % 12) + 1;

  if (targetYear > 9999) {
    throw new Error('invalid_installment');
  }

  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, getDaysInMonth(targetYear, targetMonth))).padStart(2, '0')}`;
}

/** Splits integer cents exactly, distributing remainder cents to early positions. */
export function installmentSchedule(
  total: number,
  count: number,
  start: string,
) {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 120 ||
    total < count
  ) {
    throw new Error('invalid_installment');
  }

  return Array.from({ length: count }, (_, index) => ({
    installment_number: index + 1,
    amount_cents: Math.floor(total / count) + (index < total % count ? 1 : 0),
    reference_date: installmentDateAt(start, index),
  }));
}
