import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  integer,
  index,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// Keep the existing SQLite DATE affinity; values cross IPC as YYYY-MM-DD strings.
const date = customType<{ data: string }>({ dataType: () => 'DATE' });

export const usersTable = sqliteTable('user', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(),
  locale: text().$type<'pt-BR' | 'en-US'>().notNull().default('pt-BR'),
});

export const paymentsTable = sqliteTable('payments', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  type: integer().notNull(),
  catalog_key: text().unique(),
});

export const categoriesTable = sqliteTable('categories', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  color: text().notNull(),
  icon_key: text().notNull().default('other'),
  archived_at: date(),
  catalog_key: text(),
  user_id: integer()
    .notNull()
    .references(() => usersTable.id),
});

export const creditCardsTable = sqliteTable(
  'credit_cards',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [index('credit_cards_user_idx').on(table.user_id)],
);

export const creditCardInvoicesTable = sqliteTable(
  'credit_card_invoice',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    amount_cents: integer().notNull(),
    closing_date: date().notNull(),
    due_date: date().notNull(),
    paid_at: date(),
    credit_card_id: integer()
      .notNull()
      .references(() => creditCardsTable.id),
  },
  (table) => [
    index('credit_card_invoice_card_paid_idx').on(
      table.credit_card_id,
      table.paid_at,
    ),
  ],
);

export const recurrencesTable = sqliteTable(
  'recurrences',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    active: integer().notNull().default(1),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [
    check('recurrences_active_check', sql`${table.active} IN (0, 1)`),
  ],
);

export const recurrenceVersionsTable = sqliteTable(
  'recurrences_versions',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    version: integer().notNull(),
    name: text().notNull(),
    active: integer().notNull().default(1),
    amount_cents: integer().notNull(),
    frequency: integer().notNull(),
    interval: integer().notNull(),
    start_date: date().notNull(),
    end_date: date(),
    recurrence_id: integer()
      .notNull()
      .references(() => recurrencesTable.id),
  },
  (table) => [
    unique('recurrences_versions_recurrence_version_unique').on(
      table.recurrence_id,
      table.version,
    ),
    check('recurrences_versions_active_check', sql`${table.active} IN (0, 1)`),
    check(
      'recurrences_versions_frequency_check',
      sql`${table.frequency} IN (1, 2, 3, 4)`,
    ),
    check('recurrences_versions_interval_check', sql`${table.interval} > 0`),
  ],
);

export const installmentsTable = sqliteTable(
  'installment',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    total_installments: integer().notNull(),
    total_amount_cents: integer().notNull(),
    start_date: date().notNull(),
    end_date: date().notNull(),
    purchase_at: date().notNull(),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [
    check('installment_total_check', sql`${table.total_installments} > 0`),
  ],
);

export const transactionsTable = sqliteTable(
  'transactions',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    note: text(),
    type: integer().$type<1 | 2>().notNull(),
    amount_cents: integer().notNull(),
    payment_date: date(),
    reference_date: date(),
    installment_number: integer(),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
    payment_id: integer()
      .notNull()
      .references(() => paymentsTable.id),
    category_id: integer().references(() => categoriesTable.id),
    recurrence_version_id: integer().references(
      () => recurrenceVersionsTable.id,
    ),
    credit_card_invoice_id: integer().references(
      () => creditCardInvoicesTable.id,
    ),
    installment_id: integer().references(() => installmentsTable.id),
  },
  (table) => [
    index('transactions_user_payment_date_idx').on(
      table.user_id,
      table.payment_date,
    ),
    unique('transactions_installment_number_unique').on(
      table.installment_id,
      table.installment_number,
    ),
    check(
      'transactions_installment_check',
      sql`(${table.installment_id} IS NULL AND ${table.installment_number} IS NULL) OR (${table.installment_id} IS NOT NULL AND ${table.installment_number} IS NOT NULL AND ${table.installment_number} > 0)`,
    ),
  ],
);
