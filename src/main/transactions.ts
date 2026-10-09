import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type {
  TransactionDto,
  TransactionInput,
  TransactionUpdateInput,
} from '@shared/contracts/transaction';
import type { AppDatabase } from './db';
import { categoriesTable, paymentsTable, transactionsTable } from './db/schema';
import type { CreateResult } from '@shared/contracts/result';

export function createTransactionService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  function validateDetails(input: TransactionUpdateInput) {
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 200
    ) {
      throw new Error('Enter a description of up to 200 characters.');
    }

    if (input.type !== 1 && input.type !== 2) {
      throw new Error('Invalid type.');
    }

    if (
      input.note !== undefined &&
      input.note !== null &&
      typeof input.note !== 'string'
    ) {
      throw new Error('The note must be text.');
    }

    if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0) {
      throw new Error('Enter a positive amount in whole cents.');
    }

    if (!validDate(input.reference_date)) {
      throw new Error('Invalid date.');
    }

    return {
      name: input.name.trim(),
      note: input.note === undefined ? undefined : input.note?.trim() || null,
      type: input.type,
      amount_cents: input.amount_cents,
      reference_date: input.reference_date,
    };
  }

  function validate(input: TransactionInput, userId: number) {
    const details = validateDetails(input);

    if (input.payment_date !== null && !validDate(input.payment_date)) {
      throw new Error('Invalid date.');
    }

    if (
      !Number.isSafeInteger(input.payment_id) ||
      !db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.id, input.payment_id),
            inArray(paymentsTable.catalog_key, [
              'pix',
              'debit',
              'credit',
              'cash',
            ]),
          ),
        )
        .get()
    ) {
      throw new Error('Invalid payment method.');
    }

    if (
      input.category_id !== null &&
      (!Number.isSafeInteger(input.category_id) ||
        !db
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.id, input.category_id),
              eq(categoriesTable.user_id, userId),
              isNull(categoriesTable.archived_at),
            ),
          )
          .get())
    ) {
      throw new Error('Invalid category.');
    }

    return {
      ...details,
      payment_date: input.payment_date,
      payment_id: input.payment_id,
      category_id: input.category_id,
    };
  }

  function validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid identifier.');
    }
  }

  return {
    list(month: string): TransactionDto[] {
      const user = getActiveUser();

      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error('Invalid month.');
      }

      return (
        db
          .select({
            id: transactionsTable.id,
            name: transactionsTable.name,
            note: transactionsTable.note,
            amount_cents: transactionsTable.amount_cents,
            type: transactionsTable.type,
            reference_date: transactionsTable.reference_date,
            payment_date: transactionsTable.payment_date,
            payment_id: transactionsTable.payment_id,
            category: {
              id: categoriesTable.id,
              name: categoriesTable.name,
              icon_key: categoriesTable.icon_key,
              catalog_key: categoriesTable.catalog_key,
            },
          })
          .from(transactionsTable)
          .innerJoin(
            paymentsTable,
            eq(paymentsTable.id, transactionsTable.payment_id),
          )
          .leftJoin(
            categoriesTable,
            eq(categoriesTable.id, transactionsTable.category_id),
          )
          .where(
            and(
              eq(transactionsTable.user_id, user.id),
              gte(transactionsTable.reference_date, `${month}-01`),
              lt(
                transactionsTable.reference_date,
                sql`date(${`${month}-01`}, '+1 month')`,
              ),
            ),
          )
          .orderBy(
            desc(transactionsTable.reference_date),
            desc(transactionsTable.id),
          )
          .all()
          // The month predicate excludes legacy entries without a reference date.
          .map((row) => ({ ...row, reference_date: row.reference_date! }))
      );
    },

    get(id: number): TransactionInput {
      const user = getActiveUser();
      validateId(id);
      const result = db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, user.id),
          ),
        )
        .get();

      if (!result) {
        throw new Error('Transaction not found.');
      }

      if (result.reference_date === null) {
        throw new Error('The transaction has no reference date.');
      }

      return {
        name: result.name,
        note: result.note,
        type: result.type,
        amount_cents: result.amount_cents,
        reference_date: result.reference_date,
        payment_date: result.payment_date,
        payment_id: result.payment_id,
        category_id: result.category_id,
        user_id: result.user_id,
      };
    },

    create(input: TransactionInput): CreateResult {
      const user = getActiveUser();
      db.insert(transactionsTable)
        .values({ ...validate(input, user.id), user_id: user.id })
        .run();

      return { ok: true };
    },

    update(id: number, input: TransactionUpdateInput): CreateResult {
      const user = getActiveUser();
      validateId(id);

      const result = db
        .update(transactionsTable)
        .set(validateDetails(input))
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, user.id),
          ),
        )
        .run();

      if (!result.changes) {
        throw new Error('Transaction not found.');
      }

      return { ok: true };
    },

    remove(id: number) {
      const user = getActiveUser();
      validateId(id);
      const result = db
        .delete(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, user.id),
          ),
        )
        .run();

      if (!result.changes) {
        throw new Error('Transaction not found.');
      }
    },
  };
}
