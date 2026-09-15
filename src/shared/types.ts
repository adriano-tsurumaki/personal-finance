export interface TransactionInput {
  name: string;
  type: 1 | 2; // 1: income, 2: expense
  amount_cents: number;
  reference_date: string;
  payment_date: string | null;
  payment_id: number;
  category_id: number | null;
}

export interface Transaction extends TransactionInput {
  id: number;
  user_id: number;
  payment_name: string;
  category_name: string | null;
  installment_id: number | null;
  installment_number: number | null;
  recurrence_version_id: number | null;
  credit_card_invoice_id: number | null;
}

export interface TransactionOptions {
  user: { id: number; name: string; email: string };
  payments: { id: number; name: string }[];
  categories: { id: number; name: string }[];
}

export interface Api {
  getTransactionOptions(): Promise<TransactionOptions>;
  getTransactions(month: string): Promise<Transaction[]>;
  createTransaction(input: TransactionInput): Promise<void>;
  updateTransaction(id: number, input: TransactionInput): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
}
