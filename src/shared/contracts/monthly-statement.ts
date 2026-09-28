export interface MonthlyStatementDto {
  id: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  transactionCount: number;
  openingBalance: number;
  closingBalance: number;
  balanceSeries: { date: string; balance: number }[];
}
