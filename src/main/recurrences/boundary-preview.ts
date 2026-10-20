import { and, eq, gt, sql } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import type {
  RecurrenceBoundaryInput,
  RecurrenceBoundaryPreviewDto,
  RecurrenceSchedule,
} from '@shared/contracts/recurrence';
import {
  recurrenceDateAt,
  recurrenceIndexAtOrAfter,
  isRecurrenceDate,
} from '@shared/lib/recurrence-calendar';
import {
  recurrencesTable,
  recurrenceVersionsTable,
  recurrenceOccurrencesTable,
  transactionsTable,
} from '../db/schema';
import { RecurrenceError } from '../recurrences';

/** Read-only lifecycle impact, including confirmations beyond an inclusive boundary. */
export function previewRecurrenceBoundary(
  db: AppDatabase,
  userId: number,
  input: RecurrenceBoundaryInput,
): RecurrenceBoundaryPreviewDto {
  return db.transaction(() => {
    const rule = db
      .select()
      .from(recurrencesTable)
      .where(
        and(
          eq(recurrencesTable.id, input.recurrence_id),
          eq(recurrencesTable.user_id, userId),
        ),
      )
      .get();

    if (!rule || !Number.isSafeInteger(input.recurrence_id)) {
      throw new RecurrenceError('recurrence_not_found');
    }

    if (
      !rule.anchor_date ||
      rule.status === 'repair_required' ||
      rule.status === 'ended'
    ) {
      throw new RecurrenceError('recurrence_lifecycle_conflict');
    }

    const versions = db
      .select()
      .from(recurrenceVersionsTable)
      .where(eq(recurrenceVersionsTable.recurrence_id, rule.id))
      .all();
    const candidates = versions.filter(
      (version) =>
        version.start_date <= input.last_retained_date &&
        (!version.end_date || input.last_retained_date < version.end_date),
    );

    if (candidates.length !== 1) {
      throw new RecurrenceError('recurrence_occurrence_conflict');
    }

    const version = candidates[0];
    const schedule: RecurrenceSchedule = {
      anchor_date: rule.anchor_date,
      frequency: version.frequency as RecurrenceSchedule['frequency'],
      interval: version.interval,
    };

    if (!isRecurrenceDate(schedule, input.last_retained_date)) {
      throw new RecurrenceError('recurrence_occurrence_conflict');
    }

    return {
      last_retained_date: input.last_retained_date,
      first_removed_date: recurrenceDateAt(
        schedule,
        recurrenceIndexAtOrAfter(schedule, input.last_retained_date) + 1,
      ),
      confirmed_transactions: db
        .select({
          id: transactionsTable.id,
          name: transactionsTable.name,
          scheduled_date: recurrenceOccurrencesTable.scheduled_date,
          reference_date: transactionsTable.reference_date,
          amount_cents: sql<number>`coalesce((select total_amount_cents from installment where id = ${transactionsTable.installment_id} and user_id = ${userId}), ${transactionsTable.amount_cents})`,
        })
        .from(recurrenceOccurrencesTable)
        .innerJoin(
          transactionsTable,
          and(
            eq(transactionsTable.id, recurrenceOccurrencesTable.transaction_id),
            eq(transactionsTable.user_id, userId),
          ),
        )
        .where(
          and(
            eq(recurrenceOccurrencesTable.recurrence_id, rule.id),
            eq(recurrenceOccurrencesTable.state, 'confirmed'),
            gt(
              recurrenceOccurrencesTable.scheduled_date,
              input.last_retained_date,
            ),
          ),
        )
        .orderBy(
          recurrenceOccurrencesTable.scheduled_date,
          transactionsTable.id,
        )
        .all(),
    };
  });
}
