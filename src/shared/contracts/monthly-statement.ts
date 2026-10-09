/** Settled monthly cash flow. Monetary values use BRL units, not cents. */
export interface MonthlyStatementDto {
  /** Reserved identifier: summaries are computed and use 0. */
  id: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  /** Number of settled direct entries plus invoice payment events. */
  transactionCount: number;
  /** Monthly cash flow starts at zero; this is not an account balance. */
  openingBalance: number;
  closingBalance: number;
  balanceSeries: { date: string; balance: number }[];
}
