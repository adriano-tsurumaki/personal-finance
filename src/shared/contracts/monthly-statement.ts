/**
 * Monthly projected flows. Direct entries without settlement use their reference date;
 * unpaid invoices use their due date. Explicit settlement dates take precedence.
 * Monetary values use BRL units, not cents.
 */
export interface MonthlyStatementDto {
  year: number;
  month: number;
  income: number;
  expense: number;
  /** Income minus expenses within this month only. */
  net: number;
  savingsRate: number;
  /** Start of the included reporting period, when an anchor is configured. */
  reportingStartDate?: string;
  /** Baseline plus included cash flow before this month or partial month. */
  openingBalance: number;
  /** Opening balance plus this month's net projected cash flow. */
  closingBalance: number;
  balanceSeries: { date: string; balance: number }[];
}
