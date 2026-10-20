import type {
  CreditFinancingInput,
  CreditFinancingAmounts,
} from './credit-financing';
export interface TransactionDto {
  financing?: CreditFinancingAmounts | null;
  payment_method?: string | null;
  installment_id?: number | null;
  installment_number?: number | null;
  total_installments?: number | null;
  id: number;
  name: string;
  note: string | null;
  amount_cents: number;
  type: 1 | 2; // 1: income, 2: expense
  reference_date: string;
  payment_date: string | null;
  payment_id: number;
  credit_card_invoice_id?: number | null;
  invoice_paid_at?: string | null;
  category: {
    id: number;
    name: string;
    icon_key: string;
    color?: string;
    catalog_key?: string | null;
  } | null;
}

export interface TransactionInput {
  financing?: CreditFinancingInput | null;
  /** Read metadata only; creation never accepts plan associations. */
  installment_id?: number | null;
  invoice_month?: string | null;
  card_id?: number | null;
  credit_card_invoice_id?: number | null;
  historical_card?: boolean;
  correction_token?: string;
  name: string;
  note?: string | null;
  type: 1 | 2; // 1: income, 2: expense
  amount_cents: number;
  reference_date: string;
  payment_date: string | null;
  user_id: number;
  payment_id: number;
  category_id: number | null;
}

/** Editable details; ownership, classification, and settlement stay in main. */
export type TransactionUpdateInput = Pick<
  TransactionInput,
  'name' | 'note' | 'type' | 'amount_cents' | 'reference_date' | 'financing'
> & { correction_token?: string };
