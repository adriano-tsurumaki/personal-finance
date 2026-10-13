/** Returns the Gregorian month length in days; month is one-based (1–12). */
export function getDaysInMonth(year: number, month: number): number {
  if (
    !Number.isSafeInteger(year) ||
    year < 0 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError(
      'Expected a nonnegative integer year and a month from 1 to 12.',
    );
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
}
