export type PaymentMethodKey = 'pix' | 'debit' | 'credit' | 'cash';
export type DefaultCategoryKey = 'food' | 'housing' | 'salary' | 'other';

export interface ProfileOptionsDto {
  categories: {
    id: number;
    name: string;
    catalog_key: string | null;
    icon_key: string;
    description?: string | null;
    transaction_type?: 'income' | 'expense' | 'both';
    color?: string;
  }[];
  payments: { id: number; catalog_key: PaymentMethodKey }[];
}
