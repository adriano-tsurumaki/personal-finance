import type { AppDatabase } from './db';
import type { FinancialMonthDto } from '@shared/contracts/financial-month';
import { createTransactionService } from './transactions';
import { createMonthlyStatementService } from './monthly-statement';
import { createRecurrenceService } from './recurrences';

/** Publishes persisted entries and estimates from the same SQLite read snapshot. */
export function createFinancialMonthService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const transactions = createTransactionService(db, getActiveUser);
  const statements = createMonthlyStatementService(db, getActiveUser);
  const recurrences = createRecurrenceService(db, getActiveUser);

  return {
    get(month: string): FinancialMonthDto {
      return db.transaction(() => {
        const timeline = transactions.list(month);
        const occurrences = recurrences.month(month);
        let statement: FinancialMonthDto['statement'] = null;
        let statement_issue: string | null = null;
        try {
          statement = statements.get(month);
        } catch (error) {
          if ((error as { code?: string } | null)?.code !== 'repair_required') {
            throw error;
          }

          statement_issue = (error as Error).message;
        }

        return {
          transactions: timeline,
          statement,
          statement_issue,
          recurrences: occurrences,
        };
      });
    },
  };
}
