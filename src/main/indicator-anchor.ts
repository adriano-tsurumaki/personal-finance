import { eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { indicatorAnchorsTable } from './db/schema';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';
import { getDaysInMonth } from '@shared/lib/calendar';

export function createIndicatorAnchorService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  return {
    get(): IndicatorAnchorDto | null {
      return (
        db
          .select({
            start_date: indicatorAnchorsTable.start_date,
            opening_balance_cents: indicatorAnchorsTable.opening_balance_cents,
          })
          .from(indicatorAnchorsTable)
          .where(eq(indicatorAnchorsTable.user_id, getActiveUser().id))
          .get() ?? null
      );
    },
    save(input: IndicatorAnchorDto): IndicatorAnchorDto {
      const userId = getActiveUser().id;

      if (
        !input ||
        typeof input.start_date !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(input.start_date) ||
        !Number.isSafeInteger(input.opening_balance_cents)
      ) {
        throw new Error('Invalid indicator anchor.');
      }

      const [year, month, day] = input.start_date.split('-').map(Number);

      if (year < 1 || day < 1 || day > getDaysInMonth(year, month)) {
        throw new Error('Invalid indicator anchor date.');
      }

      const anchor = {
        start_date: input.start_date,
        opening_balance_cents: input.opening_balance_cents,
      };
      db.insert(indicatorAnchorsTable)
        .values({ user_id: userId, ...anchor })
        .onConflictDoUpdate({
          target: indicatorAnchorsTable.user_id,
          set: anchor,
        })
        .run();
      return anchor;
    },
    remove(): void {
      db.delete(indicatorAnchorsTable)
        .where(eq(indicatorAnchorsTable.user_id, getActiveUser().id))
        .run();
    },
  };
}
