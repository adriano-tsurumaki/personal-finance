/**
 * Monthly cash flow. Direct income without a settlement date uses its reference date.
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
  /** Number of direct receipts, settled direct expenses, and invoice payments. */
  transactionCount: number;
  /** Monthly cash flow starts at zero; this is not an account balance. */
  openingBalance: number;
  closingBalance: number;
  balanceSeries: { date: string; balance: number }[];
}
