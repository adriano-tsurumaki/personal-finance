import type { MonthlyStatementDto } from './monthly-statement';
import type { RecurrenceMonthDto } from './recurrence';
import type { TransactionDto } from './transaction';

/** A consistent read snapshot for the selected financial period. */
export interface FinancialMonthDto {
  transactions: TransactionDto[];
  statement: MonthlyStatementDto | null;
  statement_issue: string | null;
  recurrences: RecurrenceMonthDto;
}
