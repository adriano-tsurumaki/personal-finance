import Database from 'better-sqlite3';

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      db.exec(`
      CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        payment_date DATE,
        reference_date DATE,
        installment_number INTEGER,

        user_id INTEGER NOT NULL,
        payment_id INTEGER NOT NULL,
        category_id INTEGER,
        recurrence_version_id INTEGER,
        credit_card_invoice_id INTEGER,
        installment_id INTEGER,

        FOREIGN KEY (user_id) REFERENCES user(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (recurrence_version_id) REFERENCES recurrences_versions(id),
        FOREIGN KEY (credit_card_invoice_id) REFERENCES credit_card_invoice(id),
        FOREIGN KEY (installment_id) REFERENCES installment(id),

        UNIQUE (installment_id, installment_number),
        CHECK (
          (installment_id IS NULL AND installment_number IS NULL)
          OR
          (installment_id IS NOT NULL
            AND installment_number IS NOT NULL
            AND installment_number > 0)
        )
      );

      CREATE TABLE IF NOT EXISTS credit_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,

        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      );

      CREATE TABLE IF NOT EXISTS credit_card_invoice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount_cents INTEGER NOT NULL,
        closing_date DATE NOT NULL,
        due_date DATE NOT NULL,
        paid_at DATE,

        credit_card_id INTEGER NOT NULL,
        FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        archived_at DATE,

        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      );

      CREATE TABLE IF NOT EXISTS recurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),

        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      );

      CREATE TABLE IF NOT EXISTS recurrences_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        amount_cents INTEGER NOT NULL,
        -- 1: daily, 2: weekly, 3: monthly, 4: yearly
        frequency INTEGER NOT NULL CHECK (frequency IN (1, 2, 3, 4)),
        interval INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,

        recurrence_id INTEGER NOT NULL,
        FOREIGN KEY (recurrence_id) REFERENCES recurrences(id),

        UNIQUE (recurrence_id, version),

        CHECK (interval > 0)
      );

      CREATE TABLE IF NOT EXISTS installment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_installments INTEGER NOT NULL,
        total_amount_cents INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        purchase_at DATE NOT NULL,

        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id),

        CHECK (total_installments > 0)
      );
    `);
    })();
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
