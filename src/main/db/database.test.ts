import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb } from '../db';
import { createTransactionService } from '../transactions';
import { createMonthlyStatementService } from '../monthly-statement';
import { createProfileService, initializeProfile } from '../profiles';
import {
  categoriesTable,
  creditCardsTable,
  creditCardInvoicesTable,
  installmentsTable,
  paymentsTable,
  recurrenceVersionsTable,
  recurrencesTable,
  transactionsTable,
  usersTable,
} from './schema';

const migrationsFolder = resolve('drizzle');
const migrationCount = readdirSync(migrationsFolder, {
  withFileTypes: true,
}).filter((entry) => entry.isDirectory()).length;

test('profiles persist locale changes, initialize once and isolate financial records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-profiles-'));
  const filename = join(directory, 'profiles.db');
  let db = initDb(filename, migrationsFolder);

  try {
    let profiles = createProfileService(db);
    const service = createTransactionService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(profiles.current(), null);
    assert.deepEqual(profiles.list(), []);
    assert.throws(() => service.list('2026-10'), /No active profile/);
    const first = profiles.create({
      name: ' First ',
      email: 'FIRST@example.test',
      locale: 'en-US',
    });
    assert.ok(first.ok);
    assert.equal(first.profile.name, 'First');
    assert.equal(first.profile.email, 'first@example.test');
    assert.equal(first.profile.locale, 'en-US');
    const options = profiles.options();
    assert.equal(options.categories.length, 4);
    assert.deepEqual(
      options.payments.map((method) => method.catalog_key).sort(),
      ['cash', 'credit', 'debit', 'pix'],
    );
    const input = {
      name: 'Private entry',
      type: 2 as const,
      amount_cents: 123456,
      user_id: 999,
      payment_id: options.payments[0].id,
      category_id: options.categories[0].id,
      reference_date: '2026-10-08',
      payment_date: null,
    };
    service.create(input);
    const entry = service.list('2026-10')[0];
    assert.equal(service.get(entry.id).user_id, first.profile.id);
    db.update(categoriesTable)
      .set({ name: 'My meals', color: '#123456', archived_at: '2026-10-08' })
      .where(eq(categoriesTable.id, options.categories[0].id))
      .run();
    profiles.leave();
    assert.throws(() => service.get(entry.id), /No active profile/);
    const second = profiles.create({
      name: 'Second',
      email: 'second@example.test',
      locale: 'pt-BR',
    });
    assert.ok(second.ok);
    assert.deepEqual(service.list('2026-10'), []);
    assert.throws(() => service.get(entry.id), /not found/);
    assert.throws(() => service.create(input), /Invalid category/);
    const arbitrary = db
      .insert(paymentsTable)
      .values({ name: 'Unknown method', type: 1 })
      .returning()
      .get();
    assert.throws(
      () =>
        service.create({
          ...input,
          category_id: null,
          payment_id: arbitrary.id,
        }),
      /Invalid payment/,
    );
    profiles.enter(first.profile.id);
    profiles.enter(first.profile.id);
    assert.equal(db.select().from(categoriesTable).all().length, 8);
    assert.equal(db.select().from(paymentsTable).all().length, 5);
    assert.equal(profiles.options().categories.length, 3);
    const preserved = db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, options.categories[0].id))
      .get()!;
    assert.equal(preserved.name, 'My meals');
    assert.equal(preserved.color, '#123456');
    assert.equal(preserved.catalog_key, 'food');
    assert.equal(profiles.updateLocale('pt-BR').locale, 'pt-BR');
    assert.equal(profiles.current()?.locale, 'pt-BR');
    assert.throws(
      () => profiles.updateLocale('unsupported' as 'pt-BR'),
      /Unsupported profile locale/,
    );
    assert.equal(profiles.current()?.locale, 'pt-BR');
    profiles.enter(second.profile.id);
    profiles.updateLocale('en-US');
    profiles.leave();
    assert.throws(() => profiles.updateLocale('pt-BR'), /No active profile/);
    db.$client.close();
    db = initDb(filename, migrationsFolder);
    profiles = createProfileService(db);
    assert.equal(profiles.current(), null);
    assert.equal(profiles.enter(first.profile.id).locale, 'pt-BR');
    assert.equal(profiles.enter(second.profile.id).locale, 'en-US');
    assert.equal(db.select().from(categoriesTable).all().length, 8);
    assert.equal(
      db.select().from(transactionsTable).get()!.amount_cents,
      123456,
    );
  } finally {
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid profiles and duplicate email leave no partial initialization', () => {
  const db = initDb(':memory:', migrationsFolder);

  try {
    const profiles = createProfileService(db);
    for (const input of [
      null,
      { name: '', email: 'bad', locale: 'en-US' },
      { name: 'Valid', email: 'valid@example.test', locale: 'unsupported' },
    ]) {
      assert.deepEqual(
        profiles.create(input as Parameters<typeof profiles.create>[0]),
        { ok: false, error: 'invalid_profile' },
      );
    }

    assert.deepEqual(profiles.list(), []);
    assert.equal(db.select().from(paymentsTable).all().length, 0);
    const result = profiles.create({
      name: 'Valid',
      email: 'valid@example.test',
      locale: 'pt-BR',
    });
    assert.ok(result.ok);
    assert.deepEqual(
      profiles.create({
        name: 'Duplicate',
        email: 'VALID@example.test',
        locale: 'en-US',
      }),
      { ok: false, error: 'email_in_use' },
    );
    assert.equal(profiles.list().length, 1);
    assert.equal(profiles.current()?.id, result.profile.id);
    db.run(
      sql`UPDATE user SET locale = 'unsupported' WHERE id = ${result.profile.id}`,
    );
    assert.equal(profiles.enter(result.profile.id).locale, 'pt-BR');
    assert.throws(() => profiles.enter(0), /Invalid profile/);
    assert.throws(() => profiles.enter(999), /not found/);
  } finally {
    db.$client.close();
  }
});

function setup() {
  const db = initDb(':memory:', migrationsFolder);
  const profiles = createProfileService(db);
  const result = profiles.create({
    name: 'Test user',
    email: 'test@example.test',
    locale: 'pt-BR',
  });
  assert.ok(result.ok);
  const user = result.profile;
  const service = createTransactionService(db, () => profiles.requireActive());
  const payment = db.select().from(paymentsTable).get()!;
  const category = db.select().from(categoriesTable).get()!;
  const input = {
    user_id: user.id,
    name: ' Groceries ',
    note: null,
    type: 2 as const,
    amount_cents: 12345,
    reference_date: '2026-12-31',
    payment_date: null,
    payment_id: payment.id,
    category_id: category.id,
  };
  return { db, service, user, category, input };
}

test('CRUD preserves cents, category joins, month boundaries, ordering and seed idempotence', () => {
  const { db, service, input } = setup();
  try {
    initializeProfile(db, input.user_id);
    assert.equal(db.select().from(usersTable).all().length, 1);
    assert.equal(db.select().from(paymentsTable).all().length, 4);
    assert.equal(db.select().from(categoriesTable).all().length, 4);
    service.create(input);
    service.create({ ...input, name: 'Uncategorized', category_id: null });
    service.create({ ...input, reference_date: '2027-01-01' });
    const rows = service.list('2026-12');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].category, null);
    assert.equal(rows[1].category?.icon_key, 'food');
    assert.equal(rows[1].name, 'Groceries');
    assert.equal(rows[1].amount_cents, 12345);
    assert.deepEqual(service.get(rows[1].id), {
      ...input,
      name: 'Groceries',
    });
    assert.equal(service.list('2027-01').length, 1);
    service.update(rows[1].id, {
      ...input,
      amount_cents: 999,
    });
    assert.equal(service.list('2026-12')[1].amount_cents, 999);
    service.remove(rows[0].id);
    assert.equal(service.list('2026-12').length, 1);
  } finally {
    db.$client.close();
  }
});

test('optional notes can be created, edited, preserved when omitted and cleared', () => {
  const { db, service, input } = setup();
  try {
    service.create({ ...input, note: '  Weekly groceries  ' });
    const entry = service.list('2026-12')[0];
    assert.equal(entry.note, 'Weekly groceries');
    assert.equal(service.get(entry.id).note, 'Weekly groceries');
    service.update(entry.id, { ...input, note: 'Updated note' });
    assert.equal(service.get(entry.id).note, 'Updated note');
    const { note: omittedNote, ...withoutNote } = service.get(entry.id);
    assert.equal(omittedNote, 'Updated note');
    service.update(entry.id, withoutNote);
    assert.equal(service.get(entry.id).note, 'Updated note');
    service.update(entry.id, { ...input, note: '   ' });
    assert.equal(service.get(entry.id).note, null);
    service.create({ ...input, note: undefined });
    assert.equal(service.list('2026-12')[0].note, null);
    assert.throws(
      () => service.create({ ...input, note: 123 } as unknown as typeof input),
      /must be text/,
    );
  } finally {
    db.$client.close();
  }
});

test('validation and ownership reject invalid writes and hide other users', () => {
  const { db, service, input, category } = setup();
  try {
    for (const patch of [
      { amount_cents: 1.5 },
      { amount_cents: 0 },
      { reference_date: '2026-02-30' },
      { name: '' },
      { payment_id: 99999 },
    ]) {
      assert.throws(() => service.create({ ...input, ...patch }));
    }
    assert.throws(() => service.list('2026-13'));
    assert.throws(() => service.remove(0));
    const other = db
      .insert(usersTable)
      .values({
        name: 'Other',
        email: 'other@example.test',
        password: 'disabled',
      })
      .returning()
      .get()!;
    const otherCategory = db
      .insert(categoriesTable)
      .values({ name: 'Private', color: '#fff', user_id: other.id })
      .returning()
      .get()!;
    assert.throws(
      () => service.create({ ...input, category_id: otherCategory.id }),
      /Invalid category/,
    );
    const otherEntry = db
      .insert(transactionsTable)
      .values({ ...input, user_id: other.id, category_id: null })
      .returning()
      .get()!;
    assert.equal(service.list('2026-12').length, 0);
    assert.throws(() => service.update(otherEntry.id, input), /not found/);
    assert.throws(() => service.remove(otherEntry.id), /not found/);
    db.update(categoriesTable)
      .set({ archived_at: '2026-01-01' })
      .where(eq(categoriesTable.id, category.id))
      .run();
    assert.throws(() => service.create(input), /Invalid category/);
    assert.equal(db.select().from(transactionsTable).all().length, 1);
  } finally {
    db.$client.close();
  }
});

test('historical reads and updates preserve existing archived categories without allowing new associations', () => {
  const { db, service, input, category } = setup();
  try {
    service.create(input);
    const entry = service.list('2026-12')[0];
    db.update(categoriesTable)
      .set({ archived_at: '2026-12-31' })
      .where(eq(categoriesTable.id, category.id))
      .run();
    const historical = service.get(entry.id);
    assert.equal(historical.category_id, category.id);
    assert.equal(historical.payment_date, null);
    service.update(entry.id, { ...historical, name: 'Corrected name' });
    assert.equal(service.get(entry.id).name, 'Corrected name');
    assert.throws(() => service.create(input), /Invalid category/);
    service.create({ ...input, category_id: null });
    const uncategorized = service.list('2026-12')[0];
    service.update(uncategorized.id, input);
    assert.equal(service.get(uncategorized.id).category_id, null);
    assert.throws(() => service.get(0), /Invalid identifier/);
    assert.throws(() => service.get(99999), /not found/);
  } finally {
    db.$client.close();
  }
});

test('changing the reference month preserves pending and settled payment dates', () => {
  const { db, service, input } = setup();
  try {
    for (const paymentDate of [null, '2027-01-02']) {
      service.create({ ...input, payment_date: paymentDate });
      const entry = service.list('2026-12')[0];
      service.update(entry.id, {
        ...service.get(entry.id),
        reference_date: '2027-02-10',
      });
      assert.equal(service.list('2026-12').length, 0);
      const moved = service.list('2027-02').find((row) => row.id === entry.id)!;
      assert.equal(moved.reference_date, '2027-02-10');
      assert.equal(moved.payment_date, paymentDate);
    }
  } finally {
    db.$client.close();
  }
});

test('editing legacy entries preserves classification, ownership and settlement despite extra IPC fields', () => {
  const { db, service, input, user, category } = setup();

  try {
    const legacyMethod = db
      .insert(paymentsTable)
      .values({ name: 'Custom legacy method', type: 1 })
      .returning()
      .get()!;
    const entry = db
      .insert(transactionsTable)
      .values({
        ...input,
        user_id: user.id,
        payment_id: legacyMethod.id,
        payment_date: '2027-01-02',
      })
      .returning()
      .get()!;
    db.update(categoriesTable)
      .set({ archived_at: '2026-12-31' })
      .where(eq(categoriesTable.id, category.id))
      .run();
    const maliciousInput = {
      name: 'Corrected legacy entry',
      note: 'Updated note',
      amount_cents: 25000,
      type: 2 as const,
      reference_date: '2027-02-10',
      category_id: null,
      payment_id: 99999,
      payment_date: null,
      user_id: 99999,
    };
    service.update(entry.id, maliciousInput);
    const updated = service.get(entry.id);
    assert.equal(updated.name, maliciousInput.name);
    assert.equal(updated.note, maliciousInput.note);
    assert.equal(updated.amount_cents, 25000);
    assert.equal(updated.reference_date, '2027-02-10');
    assert.equal(updated.category_id, category.id);
    assert.equal(updated.payment_id, legacyMethod.id);
    assert.equal(updated.payment_date, '2027-01-02');
    assert.equal(updated.user_id, user.id);

    for (const patch of [
      { amount_cents: 0 },
      { reference_date: '2027-02-30' },
      { name: '' },
      { type: 3 },
    ]) {
      assert.throws(() =>
        service.update(entry.id, {
          ...maliciousInput,
          ...patch,
        } as typeof maliciousInput),
      );
    }

    assert.equal(service.get(entry.id).name, maliciousInput.name);
  } finally {
    db.$client.close();
  }
});

test('schema enforces foreign keys, recurrence checks and installment uniqueness', () => {
  const { db, user, input } = setup();
  try {
    assert.throws(() =>
      db
        .insert(transactionsTable)
        .values({ ...input, user_id: 99999 })
        .run(),
    );
    assert.throws(() =>
      db
        .insert(transactionsTable)
        .values({ ...input, user_id: user.id, installment_number: 1 })
        .run(),
    );
    const installment = db
      .insert(installmentsTable)
      .values({
        name: 'Purchase',
        user_id: user.id,
        total_installments: 2,
        total_amount_cents: 24690,
        start_date: '2026-12-31',
        end_date: '2027-01-31',
        purchase_at: '2026-12-31',
      })
      .returning()
      .get()!;
    const entry = {
      ...input,
      user_id: user.id,
      installment_id: installment.id,
      installment_number: 1,
    };
    db.insert(transactionsTable).values(entry).run();
    assert.throws(() => db.insert(transactionsTable).values(entry).run());
    assert.throws(() =>
      db
        .insert(recurrencesTable)
        .values({ name: 'Invalid', user_id: user.id, active: 2 })
        .run(),
    );
    const recurrence = db
      .insert(recurrencesTable)
      .values({ name: 'Rent', user_id: user.id })
      .returning()
      .get()!;
    const version = {
      recurrence_id: recurrence.id,
      version: 1,
      name: 'Rent',
      amount_cents: 10000,
      frequency: 3,
      interval: 1,
      start_date: '2026-01-01',
    };
    assert.throws(() =>
      db
        .insert(recurrenceVersionsTable)
        .values({ ...version, interval: 0 })
        .run(),
    );
    assert.throws(() =>
      db
        .insert(recurrenceVersionsTable)
        .values({ ...version, frequency: 5 })
        .run(),
    );
    db.insert(recurrenceVersionsTable).values(version).run();
    assert.throws(() =>
      db.insert(recurrenceVersionsTable).values(version).run(),
    );
  } finally {
    db.$client.close();
  }
});

test('legacy database adoption and later migrations preserve data and run only once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-migrations-'));
  const filename = join(directory, 'legacy.db');
  const folder = join(directory, 'drizzle');
  cpSync(migrationsFolder, folder, { recursive: true });
  try {
    const legacy = drizzle(filename);
    legacy.$client.exec(
      readFileSync(resolve('src/main/db/fixtures/legacy-schema.sql'), 'utf8'),
    );
    legacy.run(
      sql`INSERT INTO user (id, name, email, password) VALUES (42, 'Existing', 'existing@example.test', 'preserved')`,
    );
    legacy.run(
      sql`INSERT INTO payments (id, name, type) VALUES (8, 'Cash', 1)`,
    );
    legacy.run(
      sql`INSERT INTO categories (id, name, color, icon_key, user_id) VALUES (9, 'Food', '#808080', 'food', 42)`,
    );
    const payment = { id: 8 };
    const category = { id: 9 };
    // Insert against the historical schema, which does not have the note column.
    legacy.run(sql`INSERT INTO transactions
      (id, name, type, amount_cents, reference_date, payment_date, user_id, payment_id, category_id)
      VALUES (73, 'Historical entry', 2, 12345, '2026-09-01', NULL, 42, ${payment.id}, ${category.id})`);
    legacy.$client.close();
    let db = initDb(filename, folder);
    assert.equal(db.select().from(usersTable).get()!.id, 42);
    assert.equal(
      db.select().from(transactionsTable).get()!.amount_cents,
      12345,
    );
    assert.equal(db.select().from(transactionsTable).get()!.id, 73);
    assert.equal(db.select().from(transactionsTable).get()!.note, null);
    assert.equal(db.select().from(categoriesTable).get()!.icon_key, 'food');
    assert.deepEqual(db.all(sql`PRAGMA foreign_key_check`), []);
    db.$client.close();
    const next = join(folder, '20990101000000_add_note');
    mkdirSync(next);
    writeFileSync(
      join(next, 'migration.sql'),
      'ALTER TABLE user ADD COLUMN note TEXT;',
    );
    db = initDb(filename, folder);
    db.run(sql`UPDATE user SET note = 'preserved note' WHERE id = 42`);
    db.update(transactionsTable)
      .set({ note: 'Historical note' })
      .where(eq(transactionsTable.id, 73))
      .run();
    db.$client.close();
    db = initDb(filename, folder);
    assert.equal(
      db.get<{ note: string }>(sql`SELECT note FROM user WHERE id = 42`)!.note,
      'preserved note',
    );
    assert.equal(
      db.select().from(transactionsTable).get()!.note,
      'Historical note',
    );
    assert.equal(
      db.all(sql`SELECT * FROM __drizzle_migrations`).length,
      migrationCount + 1,
    );
    db.$client.close();
    const failed = join(folder, '20990102000000_failure');
    mkdirSync(failed);
    writeFileSync(
      join(failed, 'migration.sql'),
      "UPDATE user SET name = 'changed';\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);",
    );
    assert.throws(() => initDb(filename, folder));
    const check = drizzle(filename);
    assert.equal(check.select().from(usersTable).get()!.name, 'Existing');
    assert.equal(
      check.all(sql`SELECT * FROM __drizzle_migrations`).length,
      migrationCount + 1,
    );
    check.$client.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('monthly cash flow aggregates settlement dates, isolates profiles and invalidates cached totals', () => {
  const db = initDb(':memory:', migrationsFolder);
  let aggregateQueries = 0;
  const observedDb = drizzle({
    client: db.$client,
    logger: {
      logQuery(query) {
        if (query.includes('GROUP BY date')) {
          aggregateQueries++;
        }
      },
    },
  });
  const profiles = createProfileService(db);
  const statements = createMonthlyStatementService(observedDb, () =>
    profiles.requireActive(),
  );
  const transactions = createTransactionService(db, () =>
    profiles.requireActive(),
  );

  try {
    assert.throws(() => statements.get('2026-10'), /No active profile/);
    const first = profiles.create({
      name: 'Cash flow',
      email: 'flow@example.test',
      locale: 'en-US',
    });
    assert.ok(first.ok);
    assert.throws(() => statements.get('2026-13'), /Invalid month/);
    assert.throws(
      () => statements.get(null as unknown as string),
      /Invalid month/,
    );
    const options = profiles.options();
    const direct = options.payments.find(
      (payment) => payment.catalog_key === 'pix',
    )!.id;
    const credit = options.payments.find(
      (payment) => payment.catalog_key === 'credit',
    )!.id;
    const input = {
      name: 'Receipt',
      type: 1 as const,
      amount_cents: 10000,
      payment_id: direct,
      category_id: null,
      user_id: first.profile.id,
      reference_date: '2026-09-15',
      payment_date: '2026-10-01',
    };
    transactions.create(input);
    transactions.create({
      ...input,
      name: 'Direct expense',
      type: 2,
      amount_cents: 2500,
      payment_date: '2026-10-31',
    });
    transactions.create({
      ...input,
      name: 'Planned expense',
      type: 2,
      amount_cents: 90000,
      payment_date: null,
    });
    transactions.create({
      ...input,
      name: 'Prior receipt',
      payment_date: '2026-09-30',
    });
    transactions.create({
      ...input,
      name: 'Future receipt',
      payment_date: '2026-11-01',
    });
    transactions.create({
      ...input,
      name: 'Unlinked card purchase',
      type: 2,
      payment_id: credit,
      amount_cents: 80000,
    });
    const card = db
      .insert(creditCardsTable)
      .values({ name: 'Card', user_id: first.profile.id })
      .returning()
      .get();
    const invoice = db
      .insert(creditCardInvoicesTable)
      .values({
        credit_card_id: card.id,
        amount_cents: 3000,
        closing_date: '2026-09-30',
        due_date: '2026-10-07',
        paid_at: '2026-10-05',
      })
      .returning()
      .get();
    db.insert(creditCardInvoicesTable)
      .values({
        credit_card_id: card.id,
        amount_cents: 7000,
        closing_date: '2026-10-31',
        due_date: '2026-11-07',
        paid_at: null,
      })
      .run();
    db.insert(transactionsTable)
      .values({
        ...input,
        name: 'Invoiced purchase',
        type: 2,
        amount_cents: 3000,
        payment_id: credit,
        credit_card_invoice_id: invoice.id,
      })
      .run();
    const statement = statements.get('2026-10');
    assert.equal(statement.income, 100);
    assert.equal(statement.expense, 55);
    assert.equal(statement.net, 45);
    assert.equal(statement.closingBalance, 45);
    assert.equal(statement.openingBalance, 0);
    assert.equal(statement.savingsRate, 0.45);
    assert.equal(statement.transactionCount, 3);
    assert.equal(statement.balanceSeries.length, 31);
    assert.deepEqual(statement.balanceSeries[0], {
      date: '2026-10-01',
      balance: 100,
    });
    assert.deepEqual(statement.balanceSeries[4], {
      date: '2026-10-05',
      balance: 70,
    });
    assert.deepEqual(statement.balanceSeries[30], {
      date: '2026-10-31',
      balance: 45,
    });
    statements.get('2026-10');
    assert.equal(aggregateQueries, 1);
    statement.balanceSeries[0].balance = 999;
    assert.equal(statements.get('2026-10').balanceSeries[0].balance, 100);
    const receipt = db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.name, 'Receipt'))
      .get()!;
    transactions.update(receipt.id, { ...input, amount_cents: 20000 });
    assert.equal(statements.get('2026-10').income, 200);
    assert.equal(aggregateQueries, 2);
    transactions.create({ ...input, amount_cents: 500 });
    assert.equal(statements.get('2026-10').income, 205);
    transactions.remove(receipt.id);
    assert.equal(statements.get('2026-10').income, 5);
    db.update(creditCardInvoicesTable)
      .set({ paid_at: '2026-11-05' })
      .where(eq(creditCardInvoicesTable.id, invoice.id))
      .run();
    assert.equal(statements.get('2026-10').expense, 25);
    assert.equal(statements.get('2026-11').expense, 30);
    const second = profiles.create({
      name: 'Other profile',
      email: 'other-flow@example.test',
      locale: 'en-US',
    });
    assert.ok(second.ok);
    assert.equal(statements.get('2026-10').net, 0);
    assert.equal(statements.get('2024-02').balanceSeries.length, 29);
    assert.equal(statements.get('2025-02').balanceSeries.length, 28);
    profiles.enter(first.profile.id);
    assert.equal(statements.get('2026-10').net, -20);
    assert.equal(statements.get('2026-12').income, 0);
    assert.equal(statements.get('2026-12').savingsRate, 0);
  } finally {
    db.$client.close();
  }
});

test('monthly cache detects external commits and queries use settlement indexes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finance-statement-'));
  const filename = join(directory, 'summary.db');
  const db = initDb(filename, migrationsFolder);
  const external = initDb(filename, migrationsFolder);

  try {
    const profiles = createProfileService(db);
    const profile = profiles.create({
      name: 'External writes',
      email: 'external@example.test',
      locale: 'en-US',
    });
    assert.ok(profile.ok);
    const statements = createMonthlyStatementService(db, () =>
      profiles.requireActive(),
    );
    assert.equal(statements.get('2026-10').income, 0);
    const payment = profiles
      .options()
      .payments.find((method) => method.catalog_key === 'cash')!;
    external
      .insert(transactionsTable)
      .values({
        name: 'External receipt',
        type: 1,
        amount_cents: 12345,
        user_id: profile.profile.id,
        payment_id: payment.id,
        reference_date: '2026-10-08',
        payment_date: '2026-10-08',
      })
      .run();
    assert.equal(statements.get('2026-10').income, 123.45);
    const plan = db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN SELECT amount_cents FROM transactions
      WHERE user_id = ${profile.profile.id} AND payment_date >= '2026-10-01' AND payment_date < '2026-11-01'
    `);
    assert.ok(
      plan.some((row) =>
        row.detail.includes('transactions_user_payment_date_idx'),
      ),
    );
    const invoicePlan = db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN SELECT i.amount_cents FROM credit_cards c
      JOIN credit_card_invoice i ON i.credit_card_id = c.id
      WHERE c.user_id = ${profile.profile.id} AND i.paid_at >= '2026-10-01' AND i.paid_at < '2026-11-01'
    `);
    assert.ok(
      invoicePlan.some((row) =>
        row.detail.includes('credit_card_invoice_card_paid_idx'),
      ),
    );
    assert.ok(
      invoicePlan.some((row) => row.detail.includes('credit_cards_user_idx')),
    );
  } finally {
    external.$client.close();
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
