import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { initDb } from '../db';
import { createProfileService } from '../profiles';
import { createCreditCardService } from '../credit-cards';
import { createRecurrenceService } from '../recurrences';
import { creditCardInvoicesTable } from './schema';

test('unknown coverage blocks only periods depending on the authoritative cash-flow date', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  try {
    const profiles = createProfileService(db);
    profiles.create({
      name: 'Coverage owner',
      email: 'coverage-review@example.test',
      locale: 'en-US',
    });
    const active = () => profiles.requireActive();
    const cards = createCreditCardService(db, active);
    const recurrences = createRecurrenceService(db, active);
    const card = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const id = recurrences.create({
      name: 'Subscription',
      type: 2,
      amount_cents: 10000,
      category_id: null,
      payment_id: profiles
        .options()
        .payments.find((row) => row.catalog_key === 'credit')!.id,
      credit_card_id: card,
      start_date: '2026-03-12',
      frequency: 3,
      interval: 1,
    });
    recurrences.boundary({
      recurrence_id: id,
      last_retained_date: '2026-03-12',
      action: 'end',
    });
    const invoice = db
      .insert(creditCardInvoicesTable)
      .values({
        credit_card_id: card,
        opening_date: '2026-02-21',
        closing_date: '2026-03-20',
        due_date: '2026-04-04',
        includes_closing_day: true,
        total_source: 'statement',
        amount_cents: 30000,
      })
      .returning()
      .get()!;
    const writes = db.get<{ count: number }>(
      sql`SELECT total_changes() AS count`,
    )!.count;
    assert.deepEqual(recurrences.getCashFlow('2026-03-01', '2026-04-01'), {
      openingIncomeCents: 0,
      openingExpenseCents: 0,
      events: [],
      days: [],
    });
    assert.throws(
      () => recurrences.getCashFlow('2026-04-01', '2026-05-01'),
      /coverage/,
    );
    assert.equal(
      db.get<{ count: number }>(sql`SELECT total_changes() AS count`)!.count,
      writes,
    );
    db.update(creditCardInvoicesTable)
      .set({ paid_at: '2026-03-25' })
      .where(eq(creditCardInvoicesTable.id, invoice.id))
      .run();
    assert.throws(
      () => recurrences.getCashFlow('2026-03-01', '2026-04-01'),
      /coverage/,
    );
    recurrences.coverage({
      recurrence_id: id,
      scheduled_date: '2026-03-12',
      credit_card_invoice_id: invoice.id,
      status: 'included',
    });
    assert.deepEqual(recurrences.getCashFlow('2026-03-01', '2026-04-01'), {
      openingIncomeCents: 0,
      openingExpenseCents: 0,
      events: [],
      days: [],
    });
  } finally {
    db.$client.close();
  }
});

test('archived defaults do not invalidate fully suppressed retained credit slots', () => {
  const db = initDb(':memory:', resolve('drizzle'));
  try {
    const profiles = createProfileService(db);
    profiles.create({
      name: 'Archive owner',
      email: 'archive-review@example.test',
      locale: 'en-US',
    });
    const active = () => profiles.requireActive();
    const cards = createCreditCardService(db, active);
    const recurrences = createRecurrenceService(db, active);
    const card = cards.create({
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 15,
    });
    const id = recurrences.create({
      name: 'Subscription',
      type: 2,
      amount_cents: 10000,
      category_id: null,
      payment_id: profiles
        .options()
        .payments.find((row) => row.catalog_key === 'credit')!.id,
      credit_card_id: card,
      start_date: '2026-03-12',
      frequency: 3,
      interval: 1,
    });
    recurrences.boundary({
      recurrence_id: id,
      last_retained_date: '2026-03-12',
      action: 'end',
    });
    recurrences.ignore({ recurrence_id: id, scheduled_date: '2026-03-12' });
    db.run(
      sql`UPDATE credit_cards SET archived_at='2026-03-13' WHERE id=${card}`,
    );
    assert.deepEqual(recurrences.getCashFlow('2026-05-01', '2026-06-01'), {
      openingIncomeCents: 0,
      openingExpenseCents: 0,
      events: [],
      days: [],
    });
    recurrences.restore({ recurrence_id: id, scheduled_date: '2026-03-12' });
    assert.throws(
      () => recurrences.getCashFlow('2026-05-01', '2026-06-01'),
      /archived/,
    );
  } finally {
    db.$client.close();
  }
});
