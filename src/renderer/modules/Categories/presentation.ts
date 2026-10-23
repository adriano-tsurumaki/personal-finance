import { categoryLabel } from '@lib/i18n';
import type { CategoryDto } from '@shared/contracts/categories';

export type CategoryFilter = 'all' | 'expense' | 'income' | 'archived';

function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .trim();
}

/** Local presentation filters never change category compatibility or stored names. */
export function filterCategories(
  categories: CategoryDto[],
  query: string,
  filter: CategoryFilter,
) {
  const key = searchKey(query);
  return categories.filter((category) => {
    const matchesType =
      filter === 'all' ||
      filter === 'archived' ||
      category.transaction_type === filter ||
      category.transaction_type === 'both';
    return matchesType && searchKey(categoryLabel(category)).includes(key);
  });
}
