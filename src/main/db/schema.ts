import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  integer,
  index,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
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

export const indicatorAnchorsTable = sqliteTable(
  'indicator_anchors',
  {
    user_id: integer()
      .primaryKey()
      .references(() => usersTable.id),
    start_date: date().notNull(),
    opening_balance_cents: integer().notNull(),
  },
  (table) => [
    check(
      'indicator_anchor_safe_balance',
      sql`${table.opening_balance_cents} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
  ],
);

export const paymentsTable = sqliteTable('payments', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  type: integer().notNull(),
  catalog_key: text().unique(),
});

export const categoriesTable = sqliteTable(
  'categories',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    color: text().notNull(),
    icon_key: text().notNull().default('other'),
    description: text(),
    transaction_type: text()
      .$type<'income' | 'expense' | 'both'>()
      .notNull()
      .default('both'),
    archived_at: date(),
    catalog_key: text(),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [
    uniqueIndex('categories_user_name_unique').on(
      table.user_id,
      sql`category_name_key(${table.name})`,
    ),
    check(
      'categories_transaction_type_check',
      sql`${table.transaction_type} IN ('income', 'expense', 'both')`,
    ),
  ],
);

export const creditCardsTable = sqliteTable(
  'credit_cards',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    closing_day: integer(),
    includes_closing_day: integer({ mode: 'boolean' }),
    due_days_after_closing: integer(),
    archived_at: date(),
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
    opening_date: date(),
    includes_closing_day: integer({ mode: 'boolean' }),
    total_source: text()
      .$type<'calculated' | 'statement'>()
      .notNull()
      .default('statement'),
    credit_card_id: integer()
      .notNull()
      .references(() => creditCardsTable.id),
  },
  (table) => [
    index('credit_card_invoice_card_paid_idx').on(
      table.credit_card_id,
      table.paid_at,
    ),
    uniqueIndex('credit_card_invoice_card_closing_unique').on(
      table.credit_card_id,
      table.closing_date,
    ),
  ],
);

export const recurrencesTable = sqliteTable(
  'recurrences',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    active: integer().notNull().default(1),
    status: text()
      .$type<'active' | 'paused' | 'ended' | 'repair_required'>()
      .notNull()
      .default('repair_required'),
    anchor_date: date(),
    last_retained_date: date(),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [
    check('recurrences_active_check', sql`${table.active} IN (0, 1)`),
    check(
      'recurrences_status_check',
      sql`${table.status} IN ('active', 'paused', 'ended', 'repair_required')`,
    ),
    index('recurrences_user_status_idx').on(table.user_id, table.status),
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
    type: integer().$type<1 | 2>(),
    category_id: integer().references(() => categoriesTable.id),
    payment_id: integer().references(() => paymentsTable.id),
    credit_card_id: integer().references(() => creditCardsTable.id),
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
      'recurrences_versions_type_check',
      sql`${table.type} IS NULL OR ${table.type} IN (1, 2)`,
    ),
    index('recurrences_versions_effective_idx').on(
      table.recurrence_id,
      table.start_date,
      table.end_date,
    ),
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
    index('transactions_invoice_idx').on(table.credit_card_invoice_id),
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

/** Retained after plan deletion so delayed retries cannot recreate purchases. */
export const installmentRequestsTable = sqliteTable(
  'installment_requests',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id),
    request_id: text().notNull(),
    input_json: text().notNull(),
    installment_id: integer().references(() => installmentsTable.id),
  },
  (table) => [
    uniqueIndex('installment_requests_user_request_unique').on(
      table.user_id,
      table.request_id,
    ),
  ],
);

export const cardHistoryTable = sqliteTable('credit_card_history', {
  id: integer().primaryKey({ autoIncrement: true }),
  user_id: integer()
    .notNull()
    .references(() => usersTable.id),
  credit_card_id: integer()
    .notNull()
    .references(() => creditCardsTable.id),
  operation: text().notNull(),
  created_at: text().notNull(),
  changes_json: text().notNull(),
});

/** Only explicit decisions are stored; reading a schedule never creates rows. */
export const recurrenceOccurrencesTable = sqliteTable(
  'recurrence_occurrences',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recurrence_id: integer()
      .notNull()
      .references(() => recurrencesTable.id),
    scheduled_date: date().notNull(),
    recurrence_version_id: integer()
      .notNull()
      .references(() => recurrenceVersionsTable.id),
    state: text().$type<'confirmed' | 'ignored'>().notNull(),
    transaction_id: integer().references(() => transactionsTable.id),
  },
  (table) => [
    uniqueIndex('recurrence_occurrences_slot_unique').on(
      table.recurrence_id,
      table.scheduled_date,
    ),
    uniqueIndex('recurrence_occurrences_transaction_unique').on(
      table.transaction_id,
    ),
    check(
      'recurrence_occurrences_state_check',
      sql`(${table.state} = 'confirmed' AND ${table.transaction_id} IS NOT NULL) OR (${table.state} = 'ignored' AND ${table.transaction_id} IS NULL)`,
    ),
  ],
);

export const recurrenceInvoiceCoverageTable = sqliteTable(
  'recurrence_invoice_coverage',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recurrence_id: integer()
      .notNull()
      .references(() => recurrencesTable.id),
    scheduled_date: date().notNull(),
    credit_card_invoice_id: integer()
      .notNull()
      .references(() => creditCardInvoicesTable.id),
    status: text().$type<'included' | 'excluded'>().notNull(),
  },
  (table) => [
    uniqueIndex('recurrence_invoice_coverage_slot_unique').on(
      table.recurrence_id,
      table.scheduled_date,
    ),
    check(
      'recurrence_invoice_coverage_status_check',
      sql`${table.status} IN ('included', 'excluded')`,
    ),
  ],
);
