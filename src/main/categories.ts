import { and, eq, gte, lt, ne } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { categoriesTable, transactionsTable } from './db/schema';
import {
  categoryIconKeys,
  type CategoryDto,
  type CategoryActivityDto,
  type CategoryInput,
  type CategoryMutationResult,
} from '@shared/contracts/categories';
import { categoryNameKey } from '@shared/lib/category-name';
import { getDaysInMonth } from '@shared/lib/calendar';
import { shiftMonth } from '@shared/lib/calc';

/** Adds whole cents without publishing an amount outside exact integer precision. */
function addActivityCents(total: number, amount: number): number {
  const sum = total + amount;

  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(sum)) {
    throw new Error('Category activity exceeds the supported amount.');
  }

  return sum;
}

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
    activity(month: string): CategoryActivityDto[] {
      const user = getActiveUser();

      if (
        typeof month !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        Number(month.slice(0, 4)) < 1000 ||
        Number(month.slice(0, 4)) > 9998
      ) {
        throw new Error('Invalid activity month.');
      }

      const [year, monthNumber] = month.split('-').map(Number);
      const days = getDaysInMonth(year, monthNumber);
      const entries = db
        .select({
          category_id: transactionsTable.category_id,
          type: transactionsTable.type,
          amount_cents: transactionsTable.amount_cents,
          reference_date: transactionsTable.reference_date,
        })
        .from(transactionsTable)
        .innerJoin(
          categoriesTable,
          and(
            eq(categoriesTable.id, transactionsTable.category_id),
            eq(categoriesTable.user_id, user.id),
          ),
        )
        .where(
          and(
            eq(transactionsTable.user_id, user.id),
            gte(transactionsTable.reference_date, `${month}-01`),
            lt(transactionsTable.reference_date, `${shiftMonth(month, 1)}-01`),
          ),
        )
        .all();
      const totals = new Map<number, CategoryActivityDto>();

      for (const entry of entries) {
        if (
          entry.category_id === null ||
          entry.reference_date === null ||
          (entry.type !== 1 && entry.type !== 2)
        ) {
          continue;
        }

        const day = Number(entry.reference_date.slice(8, 10)) - 1;

        if (!Number.isInteger(day) || day < 0 || day >= days) {
          continue;
        }

        const activity = totals.get(entry.category_id) ?? {
          category_id: entry.category_id,
          income_cents: 0,
          expense_cents: 0,
          entry_count: 0,
          income_daily_cents: Array<number>(days).fill(0),
          expense_daily_cents: Array<number>(days).fill(0),
        };
        activity.entry_count += 1;

        if (entry.type === 1) {
          activity.income_cents = addActivityCents(
            activity.income_cents,
            entry.amount_cents,
          );
          activity.income_daily_cents[day] = addActivityCents(
            activity.income_daily_cents[day],
            entry.amount_cents,
          );
        } else {
          activity.expense_cents = addActivityCents(
            activity.expense_cents,
            entry.amount_cents,
          );
          activity.expense_daily_cents[day] = addActivityCents(
            activity.expense_daily_cents[day],
            entry.amount_cents,
          );
        }

        totals.set(entry.category_id, activity);
      }

      return [...totals.values()];
    },
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
