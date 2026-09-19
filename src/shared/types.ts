import type { TransactionDto, TransactionInput } from './contracts/transaction';

export interface Api {
  getTransactions(month: string): Promise<TransactionDto[]>;
  createTransaction(input: TransactionInput): Promise<void>;
  updateTransaction(id: number, input: TransactionInput): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
}
