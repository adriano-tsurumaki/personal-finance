/**
 * Monthly projected flows. Direct entries without settlement use their reference date;
 * unpaid invoices use their due date. Explicit settlement dates take precedence.
 * Monetary values use BRL units, not cents.
 */
export interface MonthlyStatementDto {
  /** Reserved identifier: summaries are computed and use 0. */
  id: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  /** Number of direct income entries, direct expenses, and paid or due invoices. */
  transactionCount: number;
  /** Monthly cash flow starts at zero; this is not an account balance. */
  openingBalance: number;
  closingBalance: number;
  balanceSeries: { date: string; balance: number }[];
}
