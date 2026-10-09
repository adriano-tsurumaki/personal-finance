import { sql } from 'drizzle-orm';
import type { AppDatabase } from './db';
import type { MonthlyStatementDto } from '@shared/contracts/monthly-statement';

interface DailyCashFlow {
  date: string;
  income: number;
  expense: number;
  count: number;
}

/** Aggregates settled cash flow in cents; the DTO exposes BRL monetary units. */
export function createMonthlyStatementService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const cache = new Map<string, MonthlyStatementDto>();
  let revision = '';
  const cacheLimit = 24;

  return {
    get(monthKey: string): MonthlyStatementDto {
      const user = getActiveUser();

      if (
        typeof monthKey !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)
      ) {
        throw new Error('Invalid month.');
      }

      const [year, month] = monthKey.split('-').map(Number);
      const start = `${monthKey}-01`;
      const end =
        month === 12
          ? `${String(year + 1).padStart(4, '0')}-01-01`
          : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-01`;
      const key = `${user.id}:${monthKey}`;

      return db.transaction((tx) => {
        // Same-connection writes and commits from other connections both invalidate.
        const version = tx.get<{ changes: number; version: number }>(sql`
          SELECT total_changes() AS changes, data_version AS version
          FROM pragma_data_version
        `)!;
        const nextRevision = `${version.changes}:${version.version}`;

        if (nextRevision !== revision) {
          cache.clear();
          revision = nextRevision;
        }

        const cached = cache.get(key);

        if (cached) {
          cache.delete(key);
          cache.set(key, cached);
          return structuredClone(cached);
        }

        const rows = tx.all<DailyCashFlow>(sql`
          SELECT date, SUM(income) AS income, SUM(expense) AS expense,
                 COUNT(*) AS count
          FROM (
            SELECT t.payment_date AS date,
                   CASE WHEN t.type = 1 THEN t.amount_cents ELSE 0 END AS income,
                   CASE WHEN t.type = 2 THEN t.amount_cents ELSE 0 END AS expense
            FROM transactions t
            INNER JOIN payments p ON p.id = t.payment_id
            WHERE t.user_id = ${user.id}
              AND t.payment_date >= ${start} AND t.payment_date < ${end}
              AND t.credit_card_invoice_id IS NULL AND p.type = 1
            UNION ALL
            SELECT i.paid_at AS date, 0 AS income, i.amount_cents AS expense
            FROM credit_cards c
            INNER JOIN credit_card_invoice i ON i.credit_card_id = c.id
            WHERE c.user_id = ${user.id}
              AND i.paid_at >= ${start} AND i.paid_at < ${end}
          )
          GROUP BY date ORDER BY date
        `);
        const days = new Map(rows.map((row) => [row.date, row]));
        const leapYear =
          year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const dayCount = [
          31,
          leapYear ? 29 : 28,
          31,
          30,
          31,
          30,
          31,
          31,
          30,
          31,
          30,
          31,
        ][month - 1];
        let income = 0;
        let expense = 0;
        let transactionCount = 0;
        const balanceSeries: MonthlyStatementDto['balanceSeries'] = [];

        for (let day = 1; day <= dayCount; day++) {
          const date = `${monthKey}-${String(day).padStart(2, '0')}`;
          const row = days.get(date);
          income += row?.income ?? 0;
          expense += row?.expense ?? 0;
          transactionCount += row?.count ?? 0;
          balanceSeries.push({ date, balance: (income - expense) / 100 });
        }

        const statement: MonthlyStatementDto = {
          id: 0,
          year,
          month,
          income: income / 100,
          expense: expense / 100,
          net: (income - expense) / 100,
          savingsRate: income > 0 ? (income - expense) / income : 0,
          transactionCount,
          openingBalance: 0,
          closingBalance: (income - expense) / 100,
          balanceSeries,
        };
        cache.set(key, statement);

        if (cache.size > cacheLimit) {
          cache.delete(cache.keys().next().value!);
        }

        return structuredClone(statement);
      });
    },
  };
}
