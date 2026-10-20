import { sql } from 'drizzle-orm';
import type { AppDatabase } from './db';
import type {
  CashFlowEventDto,
  MonthlyStatementDto,
} from '@shared/contracts/monthly-statement';
import { getDaysInMonth } from '@shared/lib/calendar';
import { createRecurrenceService } from './recurrences';
import { createIndicatorAnchorService } from './indicator-anchor';

interface DailyCashFlow {
  date: string;
  income: number;
  expense: number;
  events?: string;
}

/** Carries projected cash flow into the month; the DTO exposes BRL units. */
export function createMonthlyStatementService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const recurrences = createRecurrenceService(db, getActiveUser);
  const anchors = createIndicatorAnchorService(db, getActiveUser);
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

        const anchor = anchors.get();
        const lowerBound = anchor?.start_date ?? '0001-01-01';

        if (lowerBound >= end) {
          throw Object.assign(new Error('before_indicator_anchor'), {
            code: 'before_indicator_anchor',
          });
        }

        const rows = tx.all<DailyCashFlow>(sql`
          SELECT CASE WHEN date < ${start} THEN '' ELSE date END AS date,
                 SUM(income) AS income, SUM(expense) AS expense,
                 json_group_array(json_object(
                   'id', kind || ':' || id, 'kind', kind, 'name', name,
                   'date', date, 'income', income / 100.0, 'expense', expense / 100.0
                 )) FILTER (WHERE date >= ${start}) AS events
          FROM (
            SELECT t.id, 'direct' AS kind, t.name, t.payment_date AS date,
                   CASE WHEN t.type = 1 THEN t.amount_cents ELSE 0 END AS income,
                   CASE WHEN t.type = 2 THEN t.amount_cents ELSE 0 END AS expense
            FROM transactions t
            INNER JOIN payments p ON p.id = t.payment_id
            WHERE t.user_id = ${user.id}
              AND t.payment_date < ${end}
              AND t.payment_date >= ${lowerBound}
              AND t.credit_card_invoice_id IS NULL AND p.type = 1
            UNION ALL
            SELECT t.id, 'direct' AS kind, t.name, t.reference_date AS date,
                   CASE WHEN t.type = 1 THEN t.amount_cents ELSE 0 END AS income,
                   CASE WHEN t.type = 2 THEN t.amount_cents ELSE 0 END AS expense
            FROM transactions t
            INNER JOIN payments p ON p.id = t.payment_id
            WHERE t.user_id = ${user.id} AND t.type IN (1, 2)
              AND t.payment_date IS NULL
              AND t.reference_date < ${end}
              AND t.reference_date >= ${lowerBound}
              AND t.credit_card_invoice_id IS NULL AND p.type = 1
            UNION ALL
            SELECT i.id, 'invoice_payment' AS kind, c.name, i.paid_at AS date, 0 AS income, i.amount_cents AS expense
            FROM credit_cards c
            INNER JOIN credit_card_invoice i ON i.credit_card_id = c.id
            WHERE c.user_id = ${user.id}
              AND i.paid_at < ${end}
              AND i.paid_at >= ${lowerBound}
            UNION ALL
            SELECT i.id, 'invoice_due' AS kind, c.name, i.due_date AS date, 0 AS income, i.amount_cents AS expense
            FROM credit_cards c
            INNER JOIN credit_card_invoice i ON i.credit_card_id = c.id
            WHERE c.user_id = ${user.id} AND i.paid_at IS NULL
              AND i.due_date < ${end}
              AND i.due_date >= ${lowerBound}
          )
          GROUP BY CASE WHEN date < ${start} THEN '' ELSE date END ORDER BY date
        `);

        const projection = recurrences.getCashFlow(
          start,
          end,
          anchor?.start_date,
        );
        const projectedDays = new Map(
          projection.days.map((day) => [day.date, day]),
        );
        const cashFlowEvents: CashFlowEventDto[] = rows.flatMap((row) =>
          row.events ? (JSON.parse(row.events) as CashFlowEventDto[]) : [],
        );
        cashFlowEvents.push(...projection.events);
        cashFlowEvents.sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        );
        const openingRow = rows.find((row) => row.date === '');

        if (openingRow) {
          openingRow.income += projection.openingIncomeCents;
          openingRow.expense += projection.openingExpenseCents;
        } else {
          rows.push({
            date: '',
            income: projection.openingIncomeCents,
            expense: projection.openingExpenseCents,
          });
        }

        for (const row of rows) {
          const projected = projectedDays.get(row.date);

          if (projected) {
            row.income += projected.incomeCents;
            row.expense += projected.expenseCents;
            projectedDays.delete(row.date);
          }
        }

        for (const day of projectedDays.values()) {
          rows.push({
            date: day.date,
            income: day.incomeCents,
            expense: day.expenseCents,
          });
        }

        for (const row of rows) {
          if (
            !Number.isSafeInteger(row.income) ||
            !Number.isSafeInteger(row.expense)
          ) {
            throw new Error('Monthly cash flow exceeds the supported amount.');
          }
        }

        const days = new Map(rows.map((row) => [row.date, row]));
        const opening = days.get('');
        const exactOpeningCents =
          BigInt(anchor?.opening_balance_cents ?? 0) +
          BigInt(opening?.income ?? 0) -
          BigInt(opening?.expense ?? 0);

        if (
          exactOpeningCents < BigInt(Number.MIN_SAFE_INTEGER) ||
          exactOpeningCents > BigInt(Number.MAX_SAFE_INTEGER)
        ) {
          throw new Error('Monthly cash flow exceeds the supported amount.');
        }

        const openingCents = Number(exactOpeningCents);
        const dayCount = getDaysInMonth(year, month);
        let income = 0;
        let expense = 0;
        const balanceSeries: MonthlyStatementDto['balanceSeries'] = [];

        for (let day = 1; day <= dayCount; day++) {
          const date = `${monthKey}-${String(day).padStart(2, '0')}`;

          if (date < lowerBound) {
            continue;
          }

          const row = days.get(date);
          income += row?.income ?? 0;
          expense += row?.expense ?? 0;

          if (
            !Number.isSafeInteger(income) ||
            !Number.isSafeInteger(expense) ||
            !Number.isSafeInteger(openingCents + (income - expense))
          ) {
            throw new Error('Monthly cash flow exceeds the supported amount.');
          }

          balanceSeries.push({
            date,
            balance: (openingCents + (income - expense)) / 100,
          });
        }

        const statement: MonthlyStatementDto = {
          ...(anchor ? { reportingStartDate: anchor.start_date } : {}),
          year,
          month,
          income: income / 100,
          expense: expense / 100,
          net: (income - expense) / 100,
          savingsRate: income > 0 ? (income - expense) / income : 0,
          openingBalance: openingCents / 100,
          closingBalance: (openingCents + (income - expense)) / 100,
          balanceSeries,
          cashFlowEvents,
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
