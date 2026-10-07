import type { MonthlyStatementDto } from './contracts/monthly-statement';
import { CreateResult } from './contracts/result';
import type { TransactionDto, TransactionInput } from './contracts/transaction';

export interface Api {
  getTransactions(month: string): Promise<TransactionDto[]>;
  createTransaction(input: TransactionInput): Promise<CreateResult>;
  updateTransaction(id: number, input: TransactionInput): Promise<void>;
  deleteTransaction(id: number): Promise<void>;

  getMonthlyStatement(month: string): Promise<MonthlyStatementDto>;
}
