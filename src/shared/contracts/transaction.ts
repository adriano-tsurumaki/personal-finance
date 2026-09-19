export interface TransactionDto {
  id: number;
  name: string;
  amount_cents: number;
  type: 1 | 2; // 1: income, 2: expense
  reference_date: string;
  payment_date: string | null;
  payment_id: number;
  category: {
    id: number;
    name: string;
    icon_key: string;
  } | null;
}

export interface TransactionInput {
  name: string;
  type: 1 | 2; // 1: income, 2: expense
  amount_cents: number;
  reference_date: string;
  payment_date: string | null;
  payment_id: number;
  category_id: number | null;
}
