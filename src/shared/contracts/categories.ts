// Serializable identifiers; React/Lucide components belong to the renderer.
export type CategoryIconKey =
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'housing'
  | 'food'
  | 'transport'
  | 'shopping'
  | 'health'
  | 'entertainment'
  | 'savings'
  | 'other';

export interface CategoryOption {
  id: number;
  name: string;
  icon_key: CategoryIconKey;
}

export const categoryIconKeys: CategoryIconKey[] = [
  'salary',
  'freelance',
  'investment',
  'housing',
  'food',
  'transport',
  'shopping',
  'health',
  'entertainment',
  'savings',
  'other',
];

export type CategoryTransactionType = 'income' | 'expense' | 'both';

export interface CategoryInput {
  name: string;
  color: string;
  icon_key: CategoryIconKey;
  description: string | null;
  transaction_type: CategoryTransactionType;
}

export interface CategoryDto extends Omit<CategoryInput, 'icon_key'> {
  id: number;
  icon_key: string;
  catalog_key: string | null;
  archived_at: string | null;
}

export type CategoryMutationResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_category' | 'duplicate_name' | 'category_not_found';
    };
