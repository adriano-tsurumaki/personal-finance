import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type {
  TransactionDto,
  TransactionInput,
} from '@shared/contracts/transaction';
import type { AppDatabase } from './db';
import {
  categoriesTable,
  paymentsTable,
  transactionsTable,
  usersTable,
} from './db/schema';
import { CreateResult } from '@shared/contracts/result';

// Fixed identity for the prototype; the renderer cannot select the user.
export const TEST_USER_EMAIL = 'teste@personal-finance.local';

export function createTransactionService(db: AppDatabase) {
  const user = db.transaction((tx) => {
    tx.insert(usersTable)
      .values({
        name: 'Test user',
        email: TEST_USER_EMAIL,
        password: '!login-disabled',
      })
      .onConflictDoNothing({ target: usersTable.email })
      .run();
    const user = tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, TEST_USER_EMAIL))
      .get();
    if (!user) throw new Error('Could not initialize the test user.');
    for (const name of ['Instant transfer', 'Cash', 'Debit card']) {
      if (
        !tx
          .select({ id: paymentsTable.id })
          .from(paymentsTable)
          .where(and(eq(paymentsTable.name, name), eq(paymentsTable.type, 1)))
          .get()
      ) {
        tx.insert(paymentsTable).values({ name, type: 1 }).run();
      }
    }
    for (const name of ['Food', 'Housing', 'Salary', 'Other']) {
      if (
        !tx
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.name, name),
              eq(categoriesTable.user_id, user.id),
            ),
          )
          .get()
      ) {
        tx.insert(categoriesTable)
          .values({
            name,
            color: '#808080',
            icon_key: name.toLowerCase(),
            user_id: user.id,
          })
          .run();
      }
    }
    return user;
  });

  function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  function validate(input: TransactionInput) {
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 200
    )
      throw new Error('Enter a description of up to 200 characters.');
    if (input.type !== 1 && input.type !== 2) throw new Error('Invalid type.');
    if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0)
      throw new Error('Enter a positive amount in whole cents.');
    if (
      !validDate(input.reference_date) ||
      (input.payment_date !== null && !validDate(input.payment_date))
    )
      throw new Error('Invalid date.');
    if (
      !Number.isSafeInteger(input.payment_id) ||
      !db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(eq(paymentsTable.id, input.payment_id))
        .get()
    )
      throw new Error('Invalid payment method.');
    if (
      input.category_id !== null &&
      (!Number.isSafeInteger(input.category_id) ||
        !db
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.id, input.category_id),
              eq(categoriesTable.user_id, user.id),
              isNull(categoriesTable.archived_at),
            ),
          )
          .get())
    )
      throw new Error('Invalid category.');
    return {
      name: input.name.trim(),
      type: input.type,
      amount_cents: input.amount_cents,
      reference_date: input.reference_date,
      payment_date: input.payment_date,
      payment_id: input.payment_id,
      category_id: input.category_id,
    };
  }

  function validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error('Invalid identifier.');
  }

  return {
    list(month: string): TransactionDto[] {
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new Error('Invalid month.');
      return (
        db
          .select({
            id: transactionsTable.id,
            name: transactionsTable.name,
            amount_cents: transactionsTable.amount_cents,
            type: transactionsTable.type,
            reference_date: transactionsTable.reference_date,
            payment_date: transactionsTable.payment_date,
            payment_id: transactionsTable.payment_id,
            category: {
              id: categoriesTable.id,
              name: categoriesTable.name,
              icon_key: categoriesTable.icon_key,
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

    create(input: TransactionInput): CreateResult {
      db.insert(transactionsTable)
        .values({ ...validate(input), user_id: user.id })
        .run();

      return { ok: true };
    },

    update(id: number, input: TransactionInput) {
      validateId(id);
      const result = db
        .update(transactionsTable)
        .set(validate(input))
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, user.id),
          ),
        )
        .run();
      if (!result.changes) throw new Error('Transaction not found.');
    },
    remove(id: number) {
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
      if (!result.changes) throw new Error('Transaction not found.');
    },
  };
}
