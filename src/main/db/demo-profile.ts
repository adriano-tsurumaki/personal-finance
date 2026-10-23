import { eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import { initializeProfile } from '../profiles';
import { createCategoryService } from '../categories';
import { createTransactionService } from '../transactions';
import {
  categoryIconKeys,
  type CategoryInput,
} from '@shared/contracts/categories';
import { currentMonthKey, shiftMonth } from '@shared/lib/calc';
import { getDaysInMonth } from '@shared/lib/calendar';
import {
  usersTable,
  categoriesTable,
  paymentsTable,
  transactionsTable,
  creditCardsTable,
  creditCardInvoicesTable,
  cardHistoryTable,
  installmentsTable,
  installmentRequestsTable,
  recurrencesTable,
  recurrenceVersionsTable,
  recurrenceOccurrencesTable,
  recurrenceInvoiceCoverageTable,
  indicatorAnchorsTable,
} from './schema';

export const demoProfileEmail = 'category-demo@example.invalid';
const demoMarker = '!development-demo';

/** Replaces only the reserved development profile, atomically, using current services. */
export function recreateDemoProfile(
  db: AppDatabase,
  month = currentMonthKey(),
) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 1001 ||
    Number(month.slice(0, 4)) > 9998
  ) {
    throw new Error('Invalid demo month.');
  }

  return db.transaction(() => {
    const previous = db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, demoProfileEmail))
      .get();

    if (previous) {
      if (previous.password !== demoMarker) {
        throw new Error(
          'The reserved demo email belongs to a non-demo profile.',
        );
      }

      const userId = previous.id;
      const rules = db
        .select({ id: recurrencesTable.id })
        .from(recurrencesTable)
        .where(eq(recurrencesTable.user_id, userId));
      const cards = db
        .select({ id: creditCardsTable.id })
        .from(creditCardsTable)
        .where(eq(creditCardsTable.user_id, userId));
      // Remove dependent records first, including data added while exploring the demo.
      db.delete(recurrenceInvoiceCoverageTable)
        .where(inArray(recurrenceInvoiceCoverageTable.recurrence_id, rules))
        .run();
      db.delete(recurrenceOccurrencesTable)
        .where(inArray(recurrenceOccurrencesTable.recurrence_id, rules))
        .run();
      db.delete(transactionsTable)
        .where(eq(transactionsTable.user_id, userId))
        .run();
      db.delete(installmentRequestsTable)
        .where(eq(installmentRequestsTable.user_id, userId))
        .run();
      db.delete(installmentsTable)
        .where(eq(installmentsTable.user_id, userId))
        .run();
      db.delete(recurrenceVersionsTable)
        .where(inArray(recurrenceVersionsTable.recurrence_id, rules))
        .run();
      db.delete(recurrencesTable)
        .where(eq(recurrencesTable.user_id, userId))
        .run();
      db.delete(cardHistoryTable)
        .where(eq(cardHistoryTable.user_id, userId))
        .run();
      db.delete(creditCardInvoicesTable)
        .where(inArray(creditCardInvoicesTable.credit_card_id, cards))
        .run();
      db.delete(creditCardsTable)
        .where(eq(creditCardsTable.user_id, userId))
        .run();
      db.delete(indicatorAnchorsTable)
        .where(eq(indicatorAnchorsTable.user_id, userId))
        .run();
      db.delete(categoriesTable)
        .where(eq(categoriesTable.user_id, userId))
        .run();
      db.delete(usersTable).where(eq(usersTable.id, userId)).run();
    }

    const profile = db
      .insert(usersTable)
      .values({
        name: 'Category Demo',
        email: demoProfileEmail,
        password: demoMarker,
        locale: 'pt-BR',
      })
      .returning()
      .get();
    initializeProfile(db, profile.id);
    const categories = createCategoryService(db, () => profile);
    const transactions = createTransactionService(db, () => profile);
    const payment = db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.catalog_key, 'pix'))
      .get()!;
    const colors = [
      '#2563eb',
      '#16a34a',
      '#dc2626',
      '#9333ea',
      '#ea580c',
      '#0891b2',
      '#db2777',
      '#64748b',
    ];
    let transactionCount = 0;

    for (const [iconIndex, icon] of categoryIconKeys.entries()) {
      for (let variant = 0; variant < 3; variant += 1) {
        const index = iconIndex * 3 + variant;
        const type = (['income', 'expense', 'both'] as const)[
          (iconIndex + variant) % 3
        ];
        const name = `${icon.replaceAll('_', ' ')} ${['reserve', 'occasional', 'everyday'][variant]}`;
        const input: CategoryInput = {
          name: name[0].toUpperCase() + name.slice(1),
          icon_key: icon,
          color: colors[index % colors.length],
          description:
            variant === 0
              ? null
              : variant === 1
                ? 'An occasional entry to compare quiet and busy categories.'
                : 'Everyday activity with varied amounts and dates. This deliberately long description exercises the two-line card preview and its full-text tooltip, including categories retained for historical reporting after their compatibility changes or archival.',
          transaction_type: 'both',
        };
        const result = categories.create(input);

        if (!result.ok) {
          throw new Error(`Could not create demo category: ${input.name}`);
        }

        const category = categories
          .list()
          .find((row) => row.name === input.name)!;

        for (let offset = -11; offset <= 0; offset += 1) {
          const period = shiftMonth(month, offset);
          const [year, monthNumber] = period.split('-').map(Number);
          const days = getDaysInMonth(year, monthNumber);
          const count = variant === 0 ? 0 : variant === 1 ? 1 : 40;

          for (let entry = 0; entry < count; entry += 1) {
            const date = `${period}-${String(1 + ((entry * 7 + iconIndex * 3) % days)).padStart(2, '0')}`;
            const primary = type === 'income' ? 1 : 2;
            transactions.create({
              name: `${input.name} · sample ${entry + 1}`,
              note: entry % 2 === 0 ? 'Fictional development data.' : null,
              type:
                variant === 2 && entry % 7 === 0
                  ? primary === 1
                    ? 2
                    : 1
                  : primary,
              amount_cents:
                125 +
                ((index * 7919 + entry * 3253 + (offset + 11) * 1237) % 250000),
              reference_date: date,
              payment_date: entry % 3 === 0 ? null : date,
              payment_id: payment.id,
              category_id: category.id,
              user_id: profile.id,
            });
            transactionCount += 1;
          }
        }

        // Compatibility edits preserve prior opposite-type entries, just like the UI.
        const updated = categories.update(category.id, {
          ...input,
          transaction_type: type,
        });

        if (!updated.ok) {
          throw new Error(`Could not update demo category: ${input.name}`);
        }

        if (index % 4 === 0) {
          const archived = categories.archive(category.id);

          if (!archived.ok) {
            throw new Error(`Could not archive demo category: ${input.name}`);
          }
        }
      }
    }

    return {
      profileId: profile.id,
      categories: categories.list().length,
      transactions: transactionCount,
      month,
    };
  });
}
