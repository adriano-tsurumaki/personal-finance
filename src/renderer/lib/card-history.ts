import type { CardHistoryChange } from '@shared/contracts/credit-cards';
import { formatCurrency } from './format/currency';
import { getLocale, t } from './i18n';

const fields = {
  name: 'cards.name',
  amount_cents: 'cards.total',
  items_total_cents: 'cards.items_total',
  difference_cents: 'cards.difference',
  reference_date: 'cards.purchase_date',
  opening_date: 'cards.opening',
  closing_date: 'cards.closing',
  due_date: 'cards.due',
  paid_at: 'cards.payment_date',
  includes_closing_day: 'cards.includes_closing',
  total_source: 'cards.total_source',
  credit_card_invoice_id: 'cards.invoice',
  archived_at: 'cards.archived',
} as const;

export function cardDate(value: string | null): string {
  return value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString(getLocale(), {
        timeZone: 'UTC',
      })
    : t('cards.unknown');
}

export function displayCardValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (field.endsWith('_cents') && typeof value === 'number') {
    return formatCurrency(value / 100);
  }

  if (typeof value === 'boolean') {
    return t(value ? 'cards.yes' : 'cards.no');
  }

  if (value === 'calculated' || value === 'statement') {
    return t(`cards.${value}`);
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return cardDate(value);
  }

  return String(value);
}

export function cardChangeFields(change: CardHistoryChange) {
  return Object.entries(fields)
    .filter(([field]) => change.before?.[field] !== change.after?.[field])
    .map(([field, label]) => ({
      field,
      label: t(
        change.entity === 'transaction' && field === 'name'
          ? 'transactions.name'
          : change.entity === 'transaction' && field === 'amount_cents'
            ? 'transactions.amount'
            : label,
      ),
      before: displayCardValue(field, change.before?.[field]),
      after: displayCardValue(field, change.after?.[field]),
    }));
}
