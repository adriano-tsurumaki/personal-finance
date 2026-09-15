import type Database from 'better-sqlite3';
import type {
  Transaction,
  TransactionInput,
  TransactionOptions,
} from '../shared/types';

// Fixed identity for the prototype; the renderer cannot select the user.
export const TEST_USER_EMAIL = 'teste@personal-finance.local';

export function createTransactionService(db: Database.Database) {
  const user = db.transaction(() => {
    db.prepare(
      `INSERT INTO user (name, email, password) VALUES (?, ?, ?)
      ON CONFLICT(email) DO NOTHING`,
    ).run('Test user', TEST_USER_EMAIL, '!login-disabled');
    const user = db
      .prepare('SELECT id, name, email FROM user WHERE email = ?')
      .get(TEST_USER_EMAIL) as TransactionOptions['user'];
    for (const name of ['Instant transfer', 'Cash', 'Debit card']) {
      db.prepare(
        `INSERT INTO payments (name, type) SELECT ?, 1
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE name = ? AND type = 1)`,
      ).run(name, name);
    }
    for (const name of ['Food', 'Housing', 'Salary', 'Other']) {
      db.prepare(
        `INSERT INTO categories (name, color, user_id) SELECT ?, '#808080', ?
        WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ? AND user_id = ?)`,
      ).run(name, user.id, name, user.id);
    }
    return user;
  })();

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
      !db.prepare('SELECT id FROM payments WHERE id = ?').get(input.payment_id)
    )
      throw new Error('Invalid payment method.');
    if (
      input.category_id !== null &&
      (!Number.isSafeInteger(input.category_id) ||
        !db
          .prepare(
            'SELECT id FROM categories WHERE id = ? AND user_id = ? AND archived_at IS NULL',
          )
          .get(input.category_id, user.id))
    )
      throw new Error('Invalid category.');
    return [
      input.name.trim(),
      input.type,
      input.amount_cents,
      input.reference_date,
      input.payment_date,
      input.payment_id,
      input.category_id,
    ];
  }

  function validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error('Invalid identifier.');
  }

  return {
    options(): TransactionOptions {
      return {
        user,
        payments: db
          .prepare('SELECT id, name FROM payments ORDER BY name')
          .all() as TransactionOptions['payments'],
        categories: db
          .prepare(
            'SELECT id, name FROM categories WHERE user_id = ? AND archived_at IS NULL ORDER BY name',
          )
          .all(user.id) as TransactionOptions['categories'],
      };
    },
    list(month: string): Transaction[] {
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new Error('Invalid month.');
      return db
        .prepare(
          `SELECT t.*, p.name AS payment_name, c.name AS category_name
        FROM transactions t JOIN payments p ON p.id = t.payment_id
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = ? AND t.reference_date >= ? AND t.reference_date < date(?, '+1 month')
        ORDER BY t.reference_date DESC, t.id DESC`,
        )
        .all(user.id, `${month}-01`, `${month}-01`) as Transaction[];
    },
    create(input: TransactionInput) {
      db.prepare(
        `INSERT INTO transactions
        (name, type, amount_cents, reference_date, payment_date, payment_id, category_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(...validate(input), user.id);
    },
    update(id: number, input: TransactionInput) {
      validateId(id);
      const result = db
        .prepare(
          `UPDATE transactions SET name = ?, type = ?, amount_cents = ?,
        reference_date = ?, payment_date = ?, payment_id = ?, category_id = ? WHERE id = ? AND user_id = ?`,
        )
        .run(...validate(input), id, user.id);
      if (!result.changes) throw new Error('Transaction not found.');
    },
    remove(id: number) {
      validateId(id);
      if (
        !db
          .prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
          .run(id, user.id).changes
      )
        throw new Error('Transaction not found.');
    },
  };
}
