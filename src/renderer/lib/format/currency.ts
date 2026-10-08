import { getLocale } from '@lib/i18n';

type EntryKind = 'income' | 'expense' | 'milestone';

function currencyFormatter() {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: number): string {
  return currencyFormatter().format(value);
}

export function formatSignedCurrency(value: number, kind: EntryKind): string {
  if (kind === 'milestone' || !value) {
    return '';
  }

  const sign = kind === 'income' ? '+' : '\u2212';
  return `${sign}${currencyFormatter().format(value)}`;
}

function compactCurrencyFormatter() {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter().format(value);
}

export function formatYearMonthToString(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleString(getLocale(), {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toLocaleUpperCase(getLocale()) + label.slice(1);
}
