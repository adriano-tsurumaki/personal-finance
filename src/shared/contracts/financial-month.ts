import type { MonthlyStatementDto } from './monthly-statement';
import type { RecurrenceMonthDto } from './recurrence';
import type { TransactionDto } from './transaction';
import type { IndicatorAnchorDto } from './indicator-anchor';
import type { InvoicePaymentDto } from './credit-cards';

/** A consistent read snapshot for the selected financial period. */
export interface FinancialMonthDto {
  invoice_payments?: InvoicePaymentDto[];
  indicator_anchor?: IndicatorAnchorDto | null;
  transactions: TransactionDto[];
  statement: MonthlyStatementDto | null;
  statement_issue: string | null;
  recurrences: RecurrenceMonthDto;
}
