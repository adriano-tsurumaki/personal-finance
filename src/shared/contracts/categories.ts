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
