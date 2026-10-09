import { and, eq, ne } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { categoriesTable } from './db/schema';
import {
  categoryIconKeys,
  type CategoryDto,
  type CategoryInput,
  type CategoryMutationResult,
} from '@shared/contracts/categories';
import { categoryNameKey } from '@shared/lib/category-name';

export function createCategoryService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  function valid(input: CategoryInput): boolean {
    return (
      !!input &&
      typeof input.name === 'string' &&
      !!input.name.trim() &&
      input.name.trim().length <= 100 &&
      typeof input.color === 'string' &&
      /^#[0-9a-f]{6}$/i.test(input.color) &&
      categoryIconKeys.includes(input.icon_key) &&
      (input.description === null ||
        (typeof input.description === 'string' &&
          input.description.length <= 500)) &&
      ['income', 'expense', 'both'].includes(input.transaction_type)
    );
  }

  function save(input: CategoryInput, id?: number): CategoryMutationResult {
    const user = getActiveUser();

    if (!valid(input)) {
      return { ok: false, error: 'invalid_category' };
    }

    return db.transaction((tx) => {
      if (
        id !== undefined &&
        (!Number.isSafeInteger(id) ||
          !tx
            .select()
            .from(categoriesTable)
            .where(
              and(
                eq(categoriesTable.id, id),
                eq(categoriesTable.user_id, user.id),
              ),
            )
            .get())
      ) {
        return { ok: false, error: 'category_not_found' };
      }

      const existing = tx
        .select()
        .from(categoriesTable)
        .where(
          id === undefined
            ? eq(categoriesTable.user_id, user.id)
            : and(
                eq(categoriesTable.user_id, user.id),
                ne(categoriesTable.id, id),
              ),
        )
        .all();

      if (
        existing.some(
          (category) =>
            categoryNameKey(category.name) === categoryNameKey(input.name),
        )
      ) {
        return { ok: false, error: 'duplicate_name' };
      }

      const values = {
        name: input.name.trim(),
        color: input.color.toLowerCase(),
        icon_key: input.icon_key,
        description: input.description?.trim() || null,
        transaction_type: input.transaction_type,
      };

      if (id === undefined) {
        tx.insert(categoriesTable)
          .values({ ...values, user_id: user.id })
          .run();
      } else {
        // Retain the catalog identity so initialization never recreates edited defaults.
        tx.update(categoriesTable)
          .set(values)
          .where(eq(categoriesTable.id, id))
          .run();
      }

      return { ok: true };
    });
  }

  return {
    list(): CategoryDto[] {
      const user = getActiveUser();
      return db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.user_id, user.id))
        .orderBy(categoriesTable.name)
        .all();
    },
    create: (input: CategoryInput) => save(input),
    update: (id: number, input: CategoryInput) => save(input, id),
    archive(id: number): CategoryMutationResult {
      const user = getActiveUser();

      if (!Number.isSafeInteger(id) || id <= 0) {
        return { ok: false, error: 'category_not_found' };
      }

      const result = db
        .update(categoriesTable)
        .set({ archived_at: new Date().toISOString().slice(0, 10) })
        .where(
          and(eq(categoriesTable.id, id), eq(categoriesTable.user_id, user.id)),
        )
        .run();
      return result.changes
        ? { ok: true }
        : { ok: false, error: 'category_not_found' };
    },
  };
}
