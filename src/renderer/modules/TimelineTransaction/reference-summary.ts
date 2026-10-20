import type { TransactionDto } from '@shared/contracts/transaction';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';

/** Totals reference-date entries in BRL; null means cent precision is unavailable. */
export function referenceSummary(
  transactions: TransactionDto[],
  occurrences: RecurrenceOccurrenceDto[],
) {
  const entries = [
    ...transactions,
    ...occurrences.filter((row) => row.state === 'unconfirmed'),
  ];
  const incomeCents = entries.reduce(
    (total, row) => total + BigInt(row.type === 1 ? row.amount_cents : 0),
    0n,
  );
  const expenseCents = entries.reduce(
    (total, row) => total + BigInt(row.type === 2 ? row.amount_cents : 0),
    0n,
  );

  if (
    incomeCents > BigInt(Number.MAX_SAFE_INTEGER) ||
    expenseCents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return null;
  }

  return {
    income: Number(incomeCents) / 100,
    expense: Number(expenseCents) / 100,
    net: Number(incomeCents - expenseCents) / 100,
  };
}
