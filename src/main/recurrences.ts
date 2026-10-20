import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from './db';
import {
  installmentRequestsTable,
  installmentsTable,
  categoriesTable,
  creditCardsTable,
  creditCardInvoicesTable,
  paymentsTable,
  recurrencesTable,
  recurrenceVersionsTable,
  recurrenceOccurrencesTable,
  recurrenceInvoiceCoverageTable,
  transactionsTable,
} from './db/schema';
import type {
  RecurrenceBoundaryInput,
  RecurrenceConfirmInput,
  RecurrenceCoverageInput,
  RecurrenceCreateInput,
  RecurrenceDefaults,
  RecurrenceMonthDto,
  RecurrenceOccurrenceDto,
  RecurrenceOccurrenceKey,
  RecurrenceResumeInput,
  RecurrenceRuleDto,
  RecurrenceSchedule,
  RecurrenceUpdateInput,
} from '@shared/contracts/recurrence';
import {
  countRecurrenceDates,
  expandRecurrenceDates,
  isRecurrenceDate,
} from '@shared/lib/recurrence-calendar';
import {
  paymentMethodsForType,
  isCreditPayment,
} from '@shared/lib/payment-method';
import { createInstallmentService } from './installments';
import {
  addCalendarDays,
  adjacentMonth,
  invoiceEnd,
  periodForMonth,
  validCalendarDate,
} from './credit-cards/billing-cycle';
import { createTransactionService } from './transactions';
import {
  aggregateCreditRecurrence,
  creditProjectionBoundaries,
} from './recurrence-credit-cash-flow';

type Rule = typeof recurrencesTable.$inferSelect;
type Version = typeof recurrenceVersionsTable.$inferSelect;
type Invoice = typeof creditCardInvoicesTable.$inferSelect;
type Decision = typeof recurrenceOccurrencesTable.$inferSelect;

export class RecurrenceError extends Error {
  readonly code: 'invalid_input' | 'not_found' | 'conflict' | 'repair_required';
  constructor(message: string) {
    super(message);
    this.code =
      /repair|coverage|archived|ambiguous|unknown|correction_required|projection_limit/.test(
        message,
      )
        ? 'repair_required'
        : /not_found/.test(message)
          ? 'not_found'
          : /conflict|stale|in_use/.test(message)
            ? 'conflict'
            : 'invalid_input';
  }
}
function fail(message: string): never {
  throw new RecurrenceError(message);
}
function exact(value: number): number {
  if (!Number.isSafeInteger(value)) {
    fail('recurrence_amount_overflow');
  }

  return value;
}
function date(value: unknown): asserts value is string {
  if (!validCalendarDate(value) || value < '0001-01-01') {
    fail('invalid_recurrence_date');
  }
}
function key(input: RecurrenceOccurrenceKey): string {
  return `${input.recurrence_id}:${input.scheduled_date}`;
}

/** Main owns ownership, sparse decisions and all monetary calculations in BRL cents. */
export function createRecurrenceService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const transactions = createTransactionService(db, getActiveUser);
  function rule(id: number): Rule {
    const row = db
      .select()
      .from(recurrencesTable)
      .where(
        and(
          eq(recurrencesTable.id, id),
          eq(recurrencesTable.user_id, getActiveUser().id),
        ),
      )
      .get();

    if (!row || !Number.isSafeInteger(id)) {
      return fail('recurrence_not_found');
    }

    return row;
  }
  function versions(id: number): Version[] {
    return db
      .select()
      .from(recurrenceVersionsTable)
      .where(eq(recurrenceVersionsTable.recurrence_id, id))
      .all()
      .sort((a, b) => a.version - b.version);
  }
  function schedule(row: Rule, version: Version): RecurrenceSchedule {
    if (!row.anchor_date || row.status === 'repair_required') {
      return fail('recurrence_repair_required');
    }

    return {
      anchor_date: row.anchor_date,
      frequency: version.frequency as RecurrenceSchedule['frequency'],
      interval: version.interval,
    };
  }
  function defaults(input: RecurrenceDefaults) {
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 200 ||
      ![1, 2].includes(input.type) ||
      !Number.isSafeInteger(input.amount_cents) ||
      input.amount_cents <= 0
    ) {
      fail('invalid_recurrence_defaults');
    }

    const method = db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, input.payment_id))
      .get();

    if (
      !method ||
      !paymentMethodsForType(input.type).includes(method.catalog_key as never)
    ) {
      fail('invalid_recurrence_payment');
    }

    if (input.category_id !== null) {
      const category = db
        .select()
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.id, input.category_id),
            eq(categoriesTable.user_id, getActiveUser().id),
          ),
        )
        .get();

      if (
        !category ||
        category.archived_at ||
        !['both', input.type === 1 ? 'income' : 'expense'].includes(
          category.transaction_type,
        )
      ) {
        fail('invalid_recurrence_category');
      }
    }

    if (isCreditPayment(method!.catalog_key)) {
      const card =
        input.credit_card_id === null
          ? null
          : db
              .select()
              .from(creditCardsTable)
              .where(
                and(
                  eq(creditCardsTable.id, input.credit_card_id),
                  eq(creditCardsTable.user_id, getActiveUser().id),
                ),
              )
              .get();

      if (
        !card ||
        card.archived_at ||
        card.closing_day === null ||
        card.includes_closing_day === null ||
        card.due_days_after_closing === null
      ) {
        fail('invalid_recurrence_card');
      }
    } else if (input.credit_card_id !== null) {
      fail('invalid_recurrence_card');
    }

    return {
      name: input.name.trim(),
      type: input.type,
      amount_cents: input.amount_cents,
      category_id: input.category_id,
      payment_id: input.payment_id,
      credit_card_id: input.credit_card_id,
    };
  }
  function selected(input: RecurrenceOccurrenceKey) {
    date(input.scheduled_date);
    const row = rule(input.recurrence_id);
    const candidates = versions(row.id).filter(
      (v) =>
        v.start_date <= input.scheduled_date &&
        (!v.end_date || input.scheduled_date < v.end_date),
    );

    if (
      candidates.length !== 1 ||
      !isRecurrenceDate(schedule(row, candidates[0]), input.scheduled_date)
    ) {
      return fail('recurrence_occurrence_conflict');
    }

    return { row, version: candidates[0] };
  }
  function decision(input: RecurrenceOccurrenceKey) {
    return db
      .select()
      .from(recurrenceOccurrencesTable)
      .where(
        and(
          eq(recurrenceOccurrencesTable.recurrence_id, input.recurrence_id),
          eq(recurrenceOccurrencesTable.scheduled_date, input.scheduled_date),
        ),
      )
      .get();
  }
  function list(): RecurrenceRuleDto[] {
    return db
      .select()
      .from(recurrencesTable)
      .where(eq(recurrencesTable.user_id, getActiveUser().id))
      .all()
      .map((row) => ({
        ...row,
        versions: versions(row.id).map((v) => ({
          ...v,
          frequency: v.frequency as RecurrenceSchedule['frequency'],
        })),
      }));
  }
  function snapshot() {
    const rules = db
      .select()
      .from(recurrencesTable)
      .where(eq(recurrencesTable.user_id, getActiveUser().id))
      .all();
    const ids = rules.map((r) => r.id);
    const allVersions = ids.length
      ? db
          .select()
          .from(recurrenceVersionsTable)
          .where(inArray(recurrenceVersionsTable.recurrence_id, ids))
          .all()
      : [];
    const decisions = ids.length
      ? db
          .select()
          .from(recurrenceOccurrencesTable)
          .where(inArray(recurrenceOccurrencesTable.recurrence_id, ids))
          .all()
      : [];
    const coverage = ids.length
      ? db
          .select()
          .from(recurrenceInvoiceCoverageTable)
          .where(inArray(recurrenceInvoiceCoverageTable.recurrence_id, ids))
          .all()
      : [];
    const cards = db
      .select()
      .from(creditCardsTable)
      .where(eq(creditCardsTable.user_id, getActiveUser().id))
      .all();
    const invoices = cards.length
      ? db
          .select()
          .from(creditCardInvoicesTable)
          .where(
            inArray(
              creditCardInvoicesTable.credit_card_id,
              cards.map((c) => c.id),
            ),
          )
          .all()
      : [];
    return {
      rules,
      versions: allVersions,
      decisions,
      decisionMap: new Map(decisions.map((d) => [key(d), d])),
      coverage: new Map(coverage.map((c) => [key(c), c])),
      cards,
      invoices,
      payments: db.select().from(paymentsTable).all(),
      categories: db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.user_id, getActiveUser().id))
        .all(),
    };
  }
  type Snapshot = ReturnType<typeof snapshot>;
  function validateProjection(v: Version, data: Snapshot): void {
    const method = data.payments.find((p) => p.id === v.payment_id);
    const category = data.categories.find((c) => c.id === v.category_id);

    if (
      !v.type ||
      !method ||
      !paymentMethodsForType(v.type).includes(method.catalog_key as never) ||
      (v.category_id !== null &&
        (!category ||
          category.archived_at ||
          !['both', v.type === 1 ? 'income' : 'expense'].includes(
            category.transaction_type,
          )))
    ) {
      fail('recurrence_repair_required');
    }
  }
  function billing(
    v: Version,
    scheduled: string,
    data: Snapshot,
  ): { invoice: Invoice | null; due: string } {
    const card = data.cards.find((c) => c.id === v.credit_card_id);

    if (!card || card.archived_at) {
      return fail('recurrence_archived_card');
    }

    const invoices = data.invoices.filter((i) => i.credit_card_id === card.id);
    const matches = invoices.filter(
      (i) =>
        i.opening_date &&
        i.includes_closing_day !== null &&
        i.opening_date <= scheduled &&
        scheduled <= invoiceEnd(i),
    );

    if (matches.length > 1) {
      return fail('recurrence_ambiguous_invoice');
    }

    if (matches.length === 1) {
      return { invoice: matches[0], due: matches[0].due_date };
    }

    if (
      card.closing_day === null ||
      card.includes_closing_day === null ||
      card.due_days_after_closing === null
    ) {
      return fail('recurrence_unknown_card_rules');
    }

    const settings = {
      closing_day: card.closing_day,
      includes_closing_day: card.includes_closing_day,
      due_days_after_closing: card.due_days_after_closing,
    };
    function period(month: string) {
      const result = periodForMonth(settings, month);
      const previous = invoices.find(
        (i) => i.closing_date.slice(0, 7) === adjacentMonth(month, -1),
      );

      if (previous) {
        result.opening_date = addCalendarDays(invoiceEnd(previous), 1);
      }

      return result;
    }
    let projected = period(scheduled.slice(0, 7));

    if (scheduled > invoiceEnd(projected)) {
      projected = period(adjacentMonth(scheduled.slice(0, 7), 1));
    }

    if (
      scheduled < projected.opening_date ||
      invoices.some(
        (i) =>
          i.closing_date === projected.closing_date ||
          (i.opening_date &&
            i.includes_closing_day !== null &&
            i.opening_date <= invoiceEnd(projected) &&
            invoiceEnd(i) >= projected.opening_date),
      )
    ) {
      return fail('recurrence_ambiguous_invoice');
    }

    return { invoice: null, due: projected.due_date };
  }
  function occurrence(
    row: Rule,
    v: Version,
    scheduled: string,
    data: Snapshot,
    explicit?: Decision,
  ): RecurrenceOccurrenceDto {
    const saved =
      explicit ??
      data.decisionMap.get(
        key({ recurrence_id: row.id, scheduled_date: scheduled }),
      );
    const actual = saved?.transaction_id
      ? db
          .select()
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.id, saved.transaction_id),
              eq(transactionsTable.user_id, getActiveUser().id),
            ),
          )
          .get()
      : null;
    const actualInvoice = actual
      ? data.invoices.find(
          (invoice) => invoice.id === actual.credit_card_invoice_id,
        )
      : undefined;
    const actualMethod = actual
      ? data.payments.find((payment) => payment.id === actual.payment_id)
      : undefined;
    const result: RecurrenceOccurrenceDto = {
      kind: 'projection',
      recurrence_id: row.id,
      scheduled_date: scheduled,
      version_id: v.id,
      name: actual?.name ?? v.name,
      type: actual?.type ?? v.type ?? 2,
      amount_cents: actual?.installment_id
        ? (db
            .select()
            .from(installmentsTable)
            .where(
              and(
                eq(installmentsTable.id, actual.installment_id),
                eq(installmentsTable.user_id, getActiveUser().id),
              ),
            )
            .get()?.total_amount_cents ?? actual.amount_cents)
        : (actual?.amount_cents ?? v.amount_cents),
      category_id: actual ? actual.category_id : v.category_id,
      payment_id: actual?.payment_id ?? v.payment_id ?? 0,
      credit_card_id: actual
        ? (data.invoices.find((i) => i.id === actual.credit_card_invoice_id)
            ?.credit_card_id ?? null)
        : v.credit_card_id,
      state: saved?.state ?? 'unconfirmed',
      transaction_id: saved?.transaction_id ?? null,
      actual_reference_date: actual?.reference_date ?? null,
      cash_flow_date: actual
        ? actual.credit_card_invoice_id !== null
          ? (actualInvoice?.paid_at ?? actualInvoice?.due_date ?? null)
          : actualMethod?.type === 1
            ? (actual.payment_date ?? actual.reference_date)
            : null
        : saved
          ? null
          : scheduled,
      credit_card_invoice_id: actual?.credit_card_invoice_id ?? null,
      coverage: 'not_required',
      issue: null,
    };

    if (saved) {
      return result;
    }

    try {
      if (
        v.type === null ||
        v.payment_id === null ||
        row.status === 'repair_required'
      ) {
        fail('recurrence_repair_required');
      }

      validateProjection(v, data);

      if (
        isCreditPayment(
          data.payments.find((p) => p.id === v.payment_id)?.catalog_key,
        )
      ) {
        const mapped = billing(v, scheduled, data);
        result.cash_flow_date = mapped.due;
        result.credit_card_invoice_id = mapped.invoice?.id ?? null;

        if (
          mapped.invoice &&
          (mapped.invoice.total_source === 'statement' ||
            mapped.invoice.paid_at)
        ) {
          result.cash_flow_date = mapped.invoice.paid_at ?? mapped.due;
          const covered = data.coverage.get(key(result));
          result.coverage =
            covered?.credit_card_invoice_id === mapped.invoice.id
              ? covered.status
              : 'unknown';

          if (result.coverage === 'unknown') {
            fail('recurrence_invoice_coverage_required');
          }

          if (result.coverage === 'included') {
            result.cash_flow_date = null;
          }

          if (result.coverage === 'excluded' && mapped.invoice.paid_at) {
            fail('recurrence_paid_invoice_correction_required');
          }
        }
      }
    } catch (error) {
      result.issue =
        error instanceof Error ? error.message : 'recurrence_repair_required';

      // A known future due date cannot make an earlier cash-flow period partial.
      // Keep the issue for the occurrence screen and let aggregation compare it
      // with its requested period before rejecting relevant unresolved totals.
      if (
        ![
          'recurrence_invoice_coverage_required',
          'recurrence_paid_invoice_correction_required',
        ].includes(result.issue)
      ) {
        result.cash_flow_date = null;
      }
    }
    return result;
  }
  function range(from: string, to: string): RecurrenceOccurrenceDto[] {
    date(from);
    date(to);

    if (from >= to) {
      fail('invalid_recurrence_range');
    }

    const data = snapshot();
    const result: RecurrenceOccurrenceDto[] = [];
    for (const row of data.rules) {
      for (const v of data.versions.filter((v) => v.recurrence_id === row.id)) {
        const start = from > v.start_date ? from : v.start_date;
        const end = v.end_date && v.end_date < to ? v.end_date : to;

        if (
          start >= end ||
          row.status === 'repair_required' ||
          !row.anchor_date
        ) {
          continue;
        }

        if (countRecurrenceDates(schedule(row, v), start, end) > 10000) {
          fail('recurrence_projection_limit');
        }

        for (const scheduled of expandRecurrenceDates(
          schedule(row, v),
          start,
          end,
        )) {
          result.push(occurrence(row, v, scheduled, data));
        }
      }
      // Confirmations beyond a later lifecycle boundary remain visible in their original month.
      for (const saved of data.decisions.filter(
        (d) =>
          d.recurrence_id === row.id &&
          from <= d.scheduled_date &&
          d.scheduled_date < to &&
          d.state === 'confirmed',
      )) {
        if (!result.some((r) => key(r) === key(saved))) {
          const v = data.versions.find(
            (v) => v.id === saved.recurrence_version_id,
          );

          if (v) {
            result.push(occurrence(row, v, saved.scheduled_date, data, saved));
          }
        }
      }
    }
    return result.sort(
      (a, b) =>
        a.scheduled_date.localeCompare(b.scheduled_date) ||
        a.recurrence_id - b.recurrence_id,
    );
  }
  return {
    list,
    dismissLegacy(id: number): void {
      db.transaction(() => {
        const row = rule(id);

        if (row.status !== 'repair_required') {
          fail('recurrence_lifecycle_conflict');
        }

        db.update(recurrencesTable)
          .set({ status: 'ended', active: 0 })
          .where(eq(recurrencesTable.id, id))
          .run();
      });
    },
    month(month: string): RecurrenceMonthDto {
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        fail('invalid_recurrence_month');
      }

      const occurrences = range(`${month}-01`, `${adjacentMonth(month, 1)}-01`);
      return {
        month,
        occurrences,
        paused_rules: list().filter(
          (r) =>
            r.status === 'paused' &&
            !!r.anchor_date &&
            r.anchor_date < `${adjacentMonth(month, 1)}-01`,
        ),
        unconfirmed_count: occurrences.filter((o) => o.state === 'unconfirmed')
          .length,
      };
    },
    forecast: range,
    create(input: RecurrenceCreateInput): number {
      return db.transaction(() => {
        const values = defaults(input);
        date(input.start_date);
        countRecurrenceDates(
          {
            anchor_date: input.start_date,
            frequency: input.frequency,
            interval: input.interval,
          },
          input.start_date,
          input.start_date,
        );
        const row = db
          .insert(recurrencesTable)
          .values({
            name: values.name,
            user_id: getActiveUser().id,
            active: 1,
            status: 'active',
            anchor_date: input.start_date,
          })
          .returning()
          .get()!;
        db.insert(recurrenceVersionsTable)
          .values({
            ...values,
            recurrence_id: row.id,
            version: 1,
            active: 1,
            frequency: input.frequency,
            interval: input.interval,
            start_date: input.start_date,
          })
          .run();
        return row.id;
      });
    },
    update(input: RecurrenceUpdateInput): void {
      db.transaction(() => {
        const { row, version } = selected(input);

        if (version.id !== input.expected_version_id) {
          fail('recurrence_stale_version');
        }

        const supplied = input as RecurrenceUpdateInput & {
          frequency?: unknown;
          interval?: unknown;
          start_date?: unknown;
          anchor_date?: unknown;
        };

        if (
          input.type !== version.type ||
          (supplied.frequency !== undefined &&
            supplied.frequency !== version.frequency) ||
          (supplied.interval !== undefined &&
            supplied.interval !== version.interval) ||
          (supplied.start_date !== undefined &&
            supplied.start_date !== row.anchor_date) ||
          (supplied.anchor_date !== undefined &&
            supplied.anchor_date !== row.anchor_date)
        ) {
          fail('invalid_recurrence_calendar_or_type_change');
        }

        const values = defaults(input);

        const later = versions(row.id).filter(
          (v) =>
            v.start_date >= input.scheduled_date &&
            v.id !== version.id &&
            (!v.end_date || v.start_date < v.end_date),
        );

        const nextVersion =
          Math.max(...versions(row.id).map((v) => v.version)) + 1;
        for (const future of later) {
          db.update(recurrenceVersionsTable)
            .set({ end_date: future.start_date, active: 0 })
            .where(eq(recurrenceVersionsTable.id, future.id))
            .run();
        }

        db.update(recurrenceVersionsTable)
          .set({
            end_date: input.scheduled_date,
            active:
              version.start_date === input.scheduled_date ? 0 : version.active,
          })
          .where(eq(recurrenceVersionsTable.id, version.id))
          .run();
        // Keep the existing active intervals, including any deliberate paused
        // gaps, while replacing all subsequent unconfirmed defaults.
        for (const [index, effective] of [version, ...later].entries()) {
          db.insert(recurrenceVersionsTable)
            .values({
              ...values,
              recurrence_id: row.id,
              version: nextVersion + index,
              active: 1,
              frequency: version.frequency,
              interval: version.interval,
              start_date:
                index === 0 ? input.scheduled_date : effective.start_date,
              end_date: effective.end_date,
            })
            .run();
        }
        db.update(recurrencesTable)
          .set({ name: values.name })
          .where(eq(recurrencesTable.id, row.id))
          .run();
      });
    },
    boundary(
      input: RecurrenceBoundaryInput & { action: 'pause' | 'end' },
    ): void {
      db.transaction(() => {
        const { row } = selected({
          recurrence_id: input.recurrence_id,
          scheduled_date: input.last_retained_date,
        });

        if (
          !['pause', 'end'].includes(input.action) ||
          row.status === 'ended'
        ) {
          fail('recurrence_lifecycle_conflict');
        }

        const end = addCalendarDays(input.last_retained_date, 1);
        for (const v of versions(row.id)) {
          if (v.start_date >= end) {
            db.update(recurrenceVersionsTable)
              .set({ end_date: v.start_date, active: 0 })
              .where(eq(recurrenceVersionsTable.id, v.id))
              .run();
          } else if (!v.end_date || v.end_date > end) {
            db.update(recurrenceVersionsTable)
              .set({ end_date: end })
              .where(eq(recurrenceVersionsTable.id, v.id))
              .run();
          }
        }
        db.update(recurrencesTable)
          .set({
            status: input.action === 'pause' ? 'paused' : 'ended',
            active: 0,
            last_retained_date: input.last_retained_date,
          })
          .where(eq(recurrencesTable.id, row.id))
          .run();
      });
    },
    resume(input: RecurrenceResumeInput): void {
      db.transaction(() => {
        date(input.first_date);
        const row = rule(input.recurrence_id);
        const all = versions(row.id);
        const last = all.at(-1)!;

        if (
          row.status !== 'paused' ||
          !row.last_retained_date ||
          input.first_date <= row.last_retained_date ||
          !isRecurrenceDate(schedule(row, last), input.first_date)
        ) {
          fail('recurrence_lifecycle_conflict');
        }

        const values = defaults({
          name: last.name,
          type: last.type!,
          amount_cents: last.amount_cents,
          category_id: last.category_id,
          payment_id: last.payment_id!,
          credit_card_id: last.credit_card_id,
        });
        db.insert(recurrenceVersionsTable)
          .values({
            ...values,
            recurrence_id: row.id,
            version: last.version + 1,
            active: 1,
            frequency: last.frequency,
            interval: last.interval,
            start_date: input.first_date,
          })
          .run();
        db.update(recurrencesTable)
          .set({ status: 'active', active: 1, last_retained_date: null })
          .where(eq(recurrencesTable.id, row.id))
          .run();
      });
    },
    confirm(input: RecurrenceConfirmInput): number {
      return db.transaction(() => {
        rule(input.recurrence_id);
        date(input.scheduled_date);
        const existing = decision(input);

        if (existing?.state === 'confirmed' && existing.transaction_id) {
          return existing.transaction_id;
        }

        if (existing) {
          fail('recurrence_occurrence_conflict');
        }

        const { version } = selected(input);

        if (version.id !== input.expected_version_id) {
          fail('recurrence_stale_version');
        }

        const values = defaults(input);
        let id: number;

        if (input.installment) {
          const draft = input.installment;

          if (
            values.type !== 2 ||
            draft.name.trim() !== values.name ||
            draft.total_amount_cents !== values.amount_cents ||
            draft.payment_id !== values.payment_id ||
            draft.card_id !== values.credit_card_id ||
            draft.category_id !== values.category_id ||
            draft.purchase_at !== input.reference_date ||
            draft.historical_card
          ) {
            fail('invalid_recurrence_installment');
          }

          if (
            db
              .select()
              .from(installmentRequestsTable)
              .where(
                and(
                  eq(installmentRequestsTable.user_id, getActiveUser().id),
                  eq(installmentRequestsTable.request_id, draft.request_id),
                ),
              )
              .get()
          ) {
            fail('recurrence_occurrence_conflict');
          }

          const planId = createInstallmentService(db, getActiveUser).create(
            draft,
            input.correction_token ?? '',
          );
          const first = db
            .select()
            .from(transactionsTable)
            .where(
              and(
                eq(transactionsTable.installment_id, planId),
                eq(transactionsTable.installment_number, 1),
                eq(transactionsTable.user_id, getActiveUser().id),
              ),
            )
            .get();

          if (
            !first ||
            db
              .select()
              .from(recurrenceOccurrencesTable)
              .where(eq(recurrenceOccurrencesTable.transaction_id, first.id))
              .get()
          ) {
            fail('recurrence_occurrence_conflict');
          }

          id = first.id;
        } else {
          id = transactions.createWithId({
            ...values,
            financing: input.financing,
            invoice_month: input.invoice_month,
            user_id: getActiveUser().id,
            payment_date: null,
            reference_date: input.reference_date,
            card_id: values.credit_card_id,
            credit_card_invoice_id: input.credit_card_invoice_id,
            correction_token: input.correction_token,
          });
        }

        db.update(transactionsTable)
          .set({ recurrence_version_id: version.id })
          .where(eq(transactionsTable.id, id))
          .run();

        db.insert(recurrenceOccurrencesTable)
          .values({
            recurrence_id: input.recurrence_id,
            scheduled_date: input.scheduled_date,
            recurrence_version_id: version.id,
            state: 'confirmed',
            transaction_id: id,
          })
          .run();
        return id;
      });
    },
    ignore(input: RecurrenceOccurrenceKey): void {
      db.transaction(() => {
        const { version } = selected(input);
        const existing = decision(input);

        if (existing?.state === 'ignored') {
          return;
        }

        if (existing) {
          fail('recurrence_occurrence_conflict');
        }

        db.insert(recurrenceOccurrencesTable)
          .values({
            ...input,
            recurrence_version_id: version.id,
            state: 'ignored',
          })
          .run();
      });
    },
    restore(input: RecurrenceOccurrenceKey): void {
      db.transaction(() => {
        selected(input);
        const existing = decision(input);

        if (!existing || existing.state !== 'ignored') {
          fail('recurrence_occurrence_conflict');
        }

        db.delete(recurrenceOccurrencesTable)
          .where(eq(recurrenceOccurrencesTable.id, existing!.id))
          .run();
      });
    },
    coverage(input: RecurrenceCoverageInput): void {
      db.transaction(() => {
        const { version } = selected(input);

        if (
          decision(input) ||
          !['included', 'excluded'].includes(input.status)
        ) {
          fail('recurrence_occurrence_conflict');
        }

        const mapped = billing(version, input.scheduled_date, snapshot());

        if (
          !mapped.invoice ||
          mapped.invoice.id !== input.credit_card_invoice_id
        ) {
          fail('recurrence_invoice_conflict');
        }

        db.insert(recurrenceInvoiceCoverageTable)
          .values(input)
          .onConflictDoUpdate({
            target: [
              recurrenceInvoiceCoverageTable.recurrence_id,
              recurrenceInvoiceCoverageTable.scheduled_date,
            ],
            set: {
              credit_card_invoice_id: input.credit_card_invoice_id,
              status: input.status,
            },
          })
          .run();
      });
    },
    getCashFlow(start: string, end: string, notBefore?: string) {
      date(start);
      date(end);

      if (notBefore !== undefined) {
        date(notBefore);
      }

      if (start >= end) {
        fail('invalid_recurrence_range');
      }

      const data = snapshot();
      let openingIncomeCents = 0;
      let openingExpenseCents = 0;
      const days = new Map<
        string,
        { date: string; incomeCents: number; expenseCents: number }
      >();
      function add(when: string, type: 1 | 2, cents: number) {
        if (when >= end || (notBefore !== undefined && when < notBefore)) {
          return;
        }

        if (when < start) {
          if (type === 1) {
            openingIncomeCents = exact(openingIncomeCents + cents);
          } else {
            openingExpenseCents = exact(openingExpenseCents + cents);
          }
        } else {
          const day = days.get(when) ?? {
            date: when,
            incomeCents: 0,
            expenseCents: 0,
          };

          if (type === 1) {
            day.incomeCents = exact(day.incomeCents + cents);
          } else {
            day.expenseCents = exact(day.expenseCents + cents);
          }

          days.set(when, day);
        }
      }
      for (const row of data.rules) {
        if (row.status === 'ended' && row.anchor_date === null) {
          continue;
        }

        if (row.status === 'repair_required') {
          fail('recurrence_repair_required');
        }

        for (const v of data.versions.filter(
          (v) => v.recurrence_id === row.id,
        )) {
          const to = v.end_date && v.end_date < end ? v.end_date : end;

          if (v.start_date >= to) {
            continue;
          }

          const cadence = schedule(row, v);

          if (
            !isCreditPayment(
              data.payments.find((p) => p.id === v.payment_id)?.catalog_key,
            )
          ) {
            const before = to < start ? to : start;
            const historyFrom =
              notBefore && notBefore > v.start_date ? notBefore : v.start_date;

            if (historyFrom < before) {
              let count = countRecurrenceDates(cadence, historyFrom, before);
              count -= data.decisions.filter(
                (d) =>
                  d.recurrence_id === row.id &&
                  historyFrom <= d.scheduled_date &&
                  d.scheduled_date < before &&
                  isRecurrenceDate(cadence, d.scheduled_date),
              ).length;

              if (count > 0) {
                validateProjection(v, data);
              }

              add(historyFrom, v.type!, exact(count * v.amount_cents));
            }

            const from = historyFrom > start ? historyFrom : start;

            if (from < to) {
              for (const scheduled of expandRecurrenceDates(
                cadence,
                from,
                to,
              )) {
                if (
                  !data.decisionMap.has(
                    key({ recurrence_id: row.id, scheduled_date: scheduled }),
                  )
                ) {
                  validateProjection(v, data);
                  add(scheduled, v.type!, v.amount_cents);
                }
              }
            }
          } else {
            const card = data.cards.find((c) => c.id === v.credit_card_id);
            const settings =
              card &&
              card.closing_day !== null &&
              card.includes_closing_day !== null &&
              card.due_days_after_closing !== null
                ? {
                    closing_day: card.closing_day,
                    includes_closing_day: card.includes_closing_day,
                    due_days_after_closing: card.due_days_after_closing,
                  }
                : null;
            const critical = [...data.decisions, ...data.coverage.values()]
              .filter((d) => d.recurrence_id === row.id)
              .flatMap((d) => [
                d.scheduled_date,
                addCalendarDays(d.scheduled_date, 1),
              ]);

            if (settings) {
              critical.push(
                ...creditProjectionBoundaries(
                  data.invoices.filter((i) => i.credit_card_id === card!.id),
                  settings,
                ),
              );
            }

            aggregateCreditRecurrence({
              schedule: cadence,
              from: v.start_date,
              to,
              start,
              end,
              notBefore,
              criticalDates: critical,
              project(scheduled) {
                if (
                  data.decisionMap.has(
                    key({ recurrence_id: row.id, scheduled_date: scheduled }),
                  )
                ) {
                  return { cash_flow_date: null, issue: null };
                }

                return occurrence(row, v, scheduled, data);
              },
              add(when, count) {
                validateProjection(v, data);
                add(when, v.type!, exact(count * v.amount_cents));
              },
              fail,
            });
          }
        }
      }
      return {
        openingIncomeCents,
        openingExpenseCents,
        days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  };
}
