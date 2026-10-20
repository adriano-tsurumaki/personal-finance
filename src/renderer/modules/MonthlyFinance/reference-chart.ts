import type { TransactionDto } from '@shared/contracts/transaction';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';
import { getDaysInMonth } from '@shared/lib/calendar';
import { referenceSummary } from '../TimelineTransaction/reference-summary';

/** Builds a zero-based monthly reference-date result in BRL, independent of settlement. */
export function referenceChart(
  monthKey: string,
  transactions: TransactionDto[],
  occurrences: RecurrenceOccurrenceDto[],
) {
  const monthlyTransactions = transactions.filter((row) =>
    row.reference_date.startsWith(`${monthKey}-`),
  );
  const monthlyOccurrences = occurrences.filter(
    (row) =>
      row.state === 'unconfirmed' &&
      row.scheduled_date.startsWith(`${monthKey}-`),
  );
  const summary = referenceSummary(monthlyTransactions, monthlyOccurrences);
  const events = [
    ...monthlyTransactions.map((row) => ({
      id: `reference:${row.id}`,
      kind: 'reference' as const,
      date: row.reference_date,
      name: row.name,
      income: row.type === 1 ? row.amount_cents / 100 : 0,
      expense: row.type === 2 ? row.amount_cents / 100 : 0,
      cents: row.type === 1 ? row.amount_cents : -row.amount_cents,
    })),
    ...monthlyOccurrences.map((row) => ({
      id: `reference-recurrence:${row.recurrence_id}:${row.scheduled_date}`,
      kind: 'recurrence' as const,
      date: row.scheduled_date,
      name: row.name,
      income: row.type === 1 ? row.amount_cents / 100 : 0,
      expense: row.type === 2 ? row.amount_cents / 100 : 0,
      cents: row.type === 1 ? row.amount_cents : -row.amount_cents,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const [year, month] = monthKey.split('-').map(Number);
  const days = new Map<string, bigint>();

  for (const event of events) {
    days.set(event.date, (days.get(event.date) ?? 0n) + BigInt(event.cents));
  }

  let balance = 0n;
  const balanceSeries = summary
    ? Array.from({ length: getDaysInMonth(year, month) }, (_, index) => {
        const date = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
        balance += days.get(date) ?? 0n;
        return { date, balance: Number(balance) / 100 };
      })
    : [];
  return { summary, events, balanceSeries };
}
