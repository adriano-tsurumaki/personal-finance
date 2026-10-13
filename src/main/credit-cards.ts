import { createHash } from 'node:crypto';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from './db';
import {
  cardHistoryTable,
  creditCardsTable,
  creditCardInvoicesTable,
  paymentsTable,
  transactionsTable,
} from './db/schema';
import type {
  CardCorrectionPreview,
  CardHistoryChange,
  CreditCardDto,
  CreditCardInput,
  InvoiceAssociationInput,
  InvoiceDetailsDto,
  InvoiceDto,
  InvoiceInput,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';
import {
  addCalendarDays,
  adjacentMonth,
  invoiceEnd,
  periodForMonth,
  validCalendarDate,
} from './credit-cards/billing-cycle';

type Card = typeof creditCardsTable.$inferSelect;
type Invoice = typeof creditCardInvoicesTable.$inferSelect;
type Entry = typeof transactionsTable.$inferSelect;

export function createCreditCardService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  function card(id: number): Card {
    const user = getActiveUser();

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('card_not_found');
    }

    const row = db
      .select()
      .from(creditCardsTable)
      .where(
        and(eq(creditCardsTable.id, id), eq(creditCardsTable.user_id, user.id)),
      )
      .get();

    if (!row) {
      throw new Error('card_not_found');
    }

    return row;
  }

  function invoice(id: number): Invoice {
    const row = db
      .select()
      .from(creditCardInvoicesTable)
      .where(eq(creditCardInvoicesTable.id, id))
      .get();

    if (!Number.isSafeInteger(id) || !row) {
      throw new Error('invoice_not_found');
    }

    card(row.credit_card_id);
    return row;
  }

  function entry(id: number): Entry {
    const row = db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, id),
          eq(transactionsTable.user_id, getActiveUser().id),
        ),
      )
      .get();

    if (!Number.isSafeInteger(id) || !row) {
      throw new Error('transaction_not_found');
    }

    return row;
  }

  function items(id: number): Entry[] {
    const rows = db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.credit_card_invoice_id, id))
      .orderBy(asc(transactionsTable.reference_date), asc(transactionsTable.id))
      .all();

    if (
      rows.some((row) => row.user_id !== getActiveUser().id || row.type !== 2)
    ) {
      throw new Error('invalid_invoice_ownership');
    }

    return rows;
  }

  function sum(rows: Entry[]): number {
    const total = rows.reduce((value, row) => value + row.amount_cents, 0);

    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      rows.some(
        (row) =>
          !Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0,
      )
    ) {
      throw new Error('invalid_invoice_total');
    }

    return total;
  }

  function dto(row: Invoice): InvoiceDto {
    const total = sum(items(row.id));
    return {
      ...row,
      items_total_cents: total,
      difference_cents: row.amount_cents - total,
    };
  }

  function history(
    cardId: number,
    operation: string,
    changes: CardHistoryChange[],
  ) {
    db.insert(cardHistoryTable)
      .values({
        user_id: getActiveUser().id,
        credit_card_id: cardId,
        operation,
        changes_json: JSON.stringify(changes),
        created_at: new Date().toISOString(),
      })
      .run();
  }

  function snapshot(
    entity: CardHistoryChange['entity'],
    before: Card | Invoice | Entry | null,
    after: Card | Invoice | Entry | null,
  ): CardHistoryChange {
    return {
      entity,
      id: (after ?? before)!.id,
      before: before ? { ...before } : null,
      after: after ? { ...after } : null,
    };
  }

  function validateInput(input: InvoiceInput) {
    if (
      !input ||
      !validCalendarDate(input.opening_date) ||
      !validCalendarDate(input.closing_date) ||
      !validCalendarDate(input.due_date) ||
      typeof input.includes_closing_day !== 'boolean' ||
      input.opening_date > invoiceEnd(input) ||
      input.due_date <= input.closing_date ||
      !['calculated', 'statement'].includes(input.total_source) ||
      !Number.isSafeInteger(input.amount_cents) ||
      input.amount_cents < 0
    ) {
      throw new Error('invalid_invoice');
    }

    return {
      opening_date: input.opening_date,
      closing_date: input.closing_date,
      due_date: input.due_date,
      includes_closing_day: input.includes_closing_day,
      total_source: input.total_source,
      amount_cents: input.amount_cents,
    };
  }

  function settings(row: Card) {
    if (
      row.closing_day === null ||
      row.includes_closing_day === null ||
      row.due_days_after_closing === null
    ) {
      throw new Error('unknown_card_rules');
    }

    return {
      closing_day: row.closing_day,
      includes_closing_day: row.includes_closing_day,
      due_days_after_closing: row.due_days_after_closing,
    };
  }

  function allInvoices(cardId: number): Invoice[] {
    card(cardId);
    return db
      .select()
      .from(creditCardInvoicesTable)
      .where(eq(creditCardInvoicesTable.credit_card_id, cardId))
      .orderBy(desc(creditCardInvoicesTable.closing_date))
      .all();
  }

  function previewPeriod(cardId: number, month: string): InvoicePeriodDto {
    const row = card(cardId);
    const period = periodForMonth(settings(row), month);
    const previous = allInvoices(cardId).find(
      (value) => value.closing_date.slice(0, 7) === adjacentMonth(month, -1),
    );

    if (
      previous?.includes_closing_day !== null &&
      previous?.includes_closing_day !== undefined
    ) {
      period.opening_date = addCalendarDays(invoiceEnd(previous), 1);
    }

    return period;
  }

  function resolveInvoice(
    cardId: number,
    date: string,
    selected: number | null,
    historical: boolean,
  ): Invoice {
    const row = card(cardId);

    if (row.archived_at && !historical) {
      throw new Error('archived_card');
    }

    if (selected !== null) {
      const chosen = invoice(selected);

      if (chosen.credit_card_id !== cardId) {
        throw new Error('invalid_invoice_ownership');
      }

      return chosen;
    }

    if (!validCalendarDate(date)) {
      throw new Error('invalid_card_dates');
    }

    const matches = allInvoices(cardId).filter(
      (value) =>
        value.opening_date &&
        value.includes_closing_day !== null &&
        date >= value.opening_date &&
        date <= invoiceEnd(value),
    );

    if (matches.length > 1) {
      throw new Error('ambiguous_invoice');
    }

    if (matches.length === 1) {
      return matches[0];
    }

    let month = date.slice(0, 7);
    let period = previewPeriod(cardId, month);

    if (date > invoiceEnd(period)) {
      month = adjacentMonth(month, 1);
      period = previewPeriod(cardId, month);
    }

    const existing = allInvoices(cardId).find(
      (value) => value.closing_date === period.closing_date,
    );

    if (
      existing ||
      date < period.opening_date ||
      allInvoices(cardId).some(
        (value) =>
          value.opening_date &&
          value.includes_closing_day !== null &&
          value.opening_date <= invoiceEnd(period) &&
          invoiceEnd(value) >= period.opening_date,
      )
    ) {
      throw new Error('ambiguous_invoice');
    }

    const created = db
      .insert(creditCardInvoicesTable)
      .values({
        ...period,
        credit_card_id: cardId,
        amount_cents: 0,
        total_source: 'calculated',
      })
      .returning()
      .get()!;
    history(cardId, 'create_invoice', [snapshot('invoice', null, created)]);
    return created;
  }

  function reconcile(id: number): CardHistoryChange | null {
    const before = invoice(id);
    const total = sum(items(id));

    if (before.total_source !== 'calculated' || before.amount_cents === total) {
      return null;
    }

    const after = db
      .update(creditCardInvoicesTable)
      .set({ amount_cents: total })
      .where(eq(creditCardInvoicesTable.id, id))
      .returning()
      .get()!;
    return snapshot('invoice', before, after);
  }

  function preview(
    changes: CardHistoryChange[],
    state: unknown,
  ): CardCorrectionPreview {
    const entryChanges = changes.filter(
      (change) => change.entity === 'transaction',
    );

    for (const change of changes.filter(
      (value) => value.entity === 'invoice',
    )) {
      const oldRows = items(change.id).filter(
        (row) =>
          !entryChanges.some(
            (value) => value.before === null && value.id === row.id,
          ),
      );
      const newRows = oldRows.filter(
        (row) => !entryChanges.some((value) => value.id === row.id),
      );

      for (const value of entryChanges) {
        if (value.after?.credit_card_invoice_id === change.id) {
          newRows.push(value.after as unknown as Entry);
        }
      }

      const beforeItems = sum(oldRows);
      const afterItems = sum(newRows);
      change.before = {
        ...change.before,
        items_total_cents: beforeItems,
        difference_cents: Number(change.before!.amount_cents) - beforeItems,
      };
      change.after = {
        ...change.after,
        items_total_cents: afterItems,
        difference_cents: Number(change.after!.amount_cents) - afterItems,
      };
    }

    const months = changes
      .filter(
        (change) =>
          change.entity === 'invoice' &&
          (change.before?.amount_cents !== change.after?.amount_cents ||
            change.before?.paid_at !== change.after?.paid_at),
      )
      .flatMap((change) => [change.before?.paid_at, change.after?.paid_at])
      .filter((value): value is string => typeof value === 'string');
    return {
      changes,
      token: createHash('sha256')
        .update(JSON.stringify({ changes, state }))
        .digest('hex'),
      affected_payment_months: [
        ...new Set(months.map((date) => date.slice(0, 7))),
      ],
    };
  }

  function invoicePlan(id: number, input: InvoiceInput) {
    const details = validateInput(input);
    const before = invoice(id);
    const entries = items(id);
    const after = {
      ...before,
      ...details,
      amount_cents:
        input.total_source === 'calculated' ? sum(entries) : input.amount_cents,
    };
    const rows = allInvoices(before.credit_card_id);
    const next = rows
      .filter((row) => row.closing_date > before.closing_date)
      .sort((a, b) => a.closing_date.localeCompare(b.closing_date))[0];
    const changes = [snapshot('invoice', before, after)];
    const state = { rows, entries: rows.map((row) => items(row.id)) };
    const moves: { id: number; invoiceId: number }[] = [];

    if (
      rows.some(
        (row) => row.id !== id && row.closing_date === after.closing_date,
      )
    ) {
      throw new Error('duplicate_invoice');
    }

    if (
      next &&
      before.includes_closing_day !== null &&
      next.opening_date === addCalendarDays(invoiceEnd(before), 1) &&
      after.closing_date < next.closing_date
    ) {
      const nextAfter = {
        ...next,
        opening_date: addCalendarDays(invoiceEnd(after), 1),
      };

      if (
        next.includes_closing_day === null ||
        nextAfter.opening_date > invoiceEnd(next)
      ) {
        throw new Error('invalid_invoice');
      }

      for (const value of [...entries, ...items(next.id)]) {
        const date = value.reference_date;

        if (
          date &&
          before.opening_date &&
          date >= before.opening_date &&
          date <= invoiceEnd(before) &&
          value.credit_card_invoice_id === id &&
          date >= nextAfter.opening_date &&
          date <= invoiceEnd(nextAfter)
        ) {
          moves.push({ id: value.id, invoiceId: next.id });
        } else if (
          date &&
          next.opening_date &&
          date >= next.opening_date &&
          date <= invoiceEnd(next) &&
          value.credit_card_invoice_id === next.id &&
          date >= after.opening_date &&
          date <= invoiceEnd(after)
        ) {
          moves.push({ id: value.id, invoiceId: id });
        }
      }

      const moveIds = new Set(moves.map((move) => move.id));
      const newCurrent = [
        ...entries.filter((value) => !moveIds.has(value.id)),
        ...items(next.id).filter((value) =>
          moves.some((move) => move.id === value.id && move.invoiceId === id),
        ),
      ];
      const newNext = [
        ...items(next.id).filter((value) => !moveIds.has(value.id)),
        ...entries.filter((value) =>
          moves.some(
            (move) => move.id === value.id && move.invoiceId === next.id,
          ),
        ),
      ];
      after.amount_cents =
        after.total_source === 'calculated'
          ? sum(newCurrent)
          : after.amount_cents;
      nextAfter.amount_cents =
        nextAfter.total_source === 'calculated'
          ? sum(newNext)
          : nextAfter.amount_cents;
      changes[0] = snapshot('invoice', before, after);
      changes.push(snapshot('invoice', next, nextAfter));

      for (const move of moves) {
        const original = entry(move.id);
        changes.push(
          snapshot('transaction', original, {
            ...original,
            credit_card_invoice_id: move.invoiceId,
          }),
        );
      }
    }

    const previous = rows.find((row) => row.closing_date < before.closing_date);

    if (
      previous?.opening_date &&
      previous.includes_closing_day !== null &&
      before.opening_date === addCalendarDays(invoiceEnd(previous), 1) &&
      after.opening_date !== before.opening_date
    ) {
      const previousClosing = addCalendarDays(
        after.opening_date,
        previous.includes_closing_day ? -1 : 0,
      );
      const dueOffset =
        (new Date(`${previous.due_date}T00:00:00Z`).getTime() -
          new Date(`${previous.closing_date}T00:00:00Z`).getTime()) /
        86400000;
      const previousAfter = {
        ...previous,
        closing_date: previousClosing,
        due_date: addCalendarDays(previousClosing, dueOffset),
      };

      if (
        previousAfter.closing_date >= after.closing_date ||
        previousAfter.opening_date! > invoiceEnd(previousAfter) ||
        rows.some(
          (row) =>
            row.id !== previous.id &&
            row.id !== id &&
            row.closing_date === previousAfter.closing_date,
        )
      ) {
        throw new Error('invalid_invoice');
      }

      const finalEntries = state.entries.flat().map((original) => {
        const changed = changes.find(
          (change) =>
            change.entity === 'transaction' && change.id === original.id,
        );
        return changed
          ? ({ ...changed.after } as unknown as Entry)
          : { ...original };
      });

      for (const original of [...entries, ...items(previous.id)]) {
        const date = original.reference_date;
        const currentEntry = finalEntries.find(
          (row) => row.id === original.id,
        )!;
        let target: number | null = null;

        if (
          date &&
          before.opening_date &&
          original.credit_card_invoice_id === id &&
          currentEntry.credit_card_invoice_id === id &&
          date >= before.opening_date &&
          date <= invoiceEnd(before) &&
          date >= previousAfter.opening_date! &&
          date <= invoiceEnd(previousAfter)
        ) {
          target = previous.id;
        } else if (
          date &&
          original.credit_card_invoice_id === previous.id &&
          date >= previous.opening_date &&
          date <= invoiceEnd(previous) &&
          date >= after.opening_date &&
          date <= invoiceEnd(after)
        ) {
          target = id;
        }

        if (target !== null) {
          currentEntry.credit_card_invoice_id = target;
          changes.push(snapshot('transaction', original, { ...currentEntry }));
        }
      }

      after.amount_cents =
        after.total_source === 'calculated'
          ? sum(finalEntries.filter((row) => row.credit_card_invoice_id === id))
          : after.amount_cents;
      previousAfter.amount_cents =
        previousAfter.total_source === 'calculated'
          ? sum(
              finalEntries.filter(
                (row) => row.credit_card_invoice_id === previous.id,
              ),
            )
          : previousAfter.amount_cents;
      changes[0] = snapshot('invoice', before, after);
      changes.push(snapshot('invoice', previous, previousAfter));
    }

    const finalPeriods = rows.map((row) => {
      const change = changes.find(
        (value) => value.entity === 'invoice' && value.id === row.id,
      );
      return change ? (change.after as unknown as Invoice) : row;
    });

    for (const period of finalPeriods) {
      const original = rows.find((row) => row.id === period.id)!;

      if (
        !period.opening_date ||
        period.includes_closing_day === null ||
        (period.opening_date === original.opening_date &&
          period.closing_date === original.closing_date &&
          period.includes_closing_day === original.includes_closing_day)
      ) {
        continue;
      }

      if (
        finalPeriods.some(
          (other) =>
            other.id !== period.id &&
            other.opening_date !== null &&
            other.includes_closing_day !== null &&
            other.opening_date <= invoiceEnd(period) &&
            invoiceEnd(other) >= period.opening_date!,
        )
      ) {
        throw new Error('ambiguous_invoice');
      }
    }

    return preview(changes, state);
  }

  return {
    list(): CreditCardDto[] {
      return db
        .select()
        .from(creditCardsTable)
        .where(eq(creditCardsTable.user_id, getActiveUser().id))
        .orderBy(asc(creditCardsTable.name))
        .all();
    },
    create(input: CreditCardInput): number {
      if (
        !input ||
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.trim().length > 100 ||
        !Number.isInteger(input.closing_day) ||
        input.closing_day < 1 ||
        input.closing_day > 31 ||
        typeof input.includes_closing_day !== 'boolean' ||
        !Number.isSafeInteger(input.due_days_after_closing) ||
        input.due_days_after_closing <= 0
      ) {
        throw new Error('invalid_card');
      }

      periodForMonth(input, new Date().toISOString().slice(0, 7));
      return db.transaction(() => {
        const row = db
          .insert(creditCardsTable)
          .values({
            closing_day: input.closing_day,
            includes_closing_day: input.includes_closing_day,
            due_days_after_closing: input.due_days_after_closing,
            name: input.name.trim(),
            user_id: getActiveUser().id,
          })
          .returning()
          .get()!;
        history(row.id, 'create_card', [snapshot('card', null, row)]);
        return row.id;
      });
    },
    rename(id: number, name: string) {
      if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        throw new Error('invalid_card');
      }

      db.transaction(() => {
        const before = card(id);
        const after = db
          .update(creditCardsTable)
          .set({ name: name.trim() })
          .where(eq(creditCardsTable.id, id))
          .returning()
          .get()!;
        history(id, 'rename_card', [snapshot('card', before, after)]);
      });
    },
    archive(id: number) {
      db.transaction(() => {
        const before = card(id);
        const after = db
          .update(creditCardsTable)
          .set({ archived_at: new Date().toISOString().slice(0, 10) })
          .where(eq(creditCardsTable.id, id))
          .returning()
          .get()!;
        history(id, 'archive_card', [snapshot('card', before, after)]);
      });
    },
    previewPeriod,
    suggestPeriod(cardId: number, date: string): InvoicePeriodDto {
      if (!validCalendarDate(date)) {
        throw new Error('invalid_card_dates');
      }

      const matches = allInvoices(cardId).filter(
        (row) =>
          row.opening_date &&
          row.includes_closing_day !== null &&
          date >= row.opening_date &&
          date <= invoiceEnd(row),
      );

      if (matches.length > 1) {
        throw new Error('ambiguous_invoice');
      }

      if (matches.length === 1) {
        const row = matches[0];
        return {
          opening_date: row.opening_date!,
          closing_date: row.closing_date,
          due_date: row.due_date,
          includes_closing_day: row.includes_closing_day!,
        };
      }

      const period = previewPeriod(cardId, date.slice(0, 7));
      return date > invoiceEnd(period)
        ? previewPeriod(cardId, adjacentMonth(date.slice(0, 7), 1))
        : period;
    },
    previewRegistration(
      input: CreditCardInput,
      month: string,
    ): InvoicePeriodDto {
      getActiveUser();

      if (
        typeof input.includes_closing_day !== 'boolean' ||
        !Number.isSafeInteger(input.due_days_after_closing) ||
        input.due_days_after_closing <= 0
      ) {
        throw new Error('invalid_card');
      }

      return periodForMonth(input, month);
    },
    invoices(cardId: number): InvoiceDto[] {
      return allInvoices(cardId).map(dto);
    },
    details(id: number): InvoiceDetailsDto {
      const row = invoice(id);
      return {
        invoice: dto(row),
        entries: items(id).map((value) => ({
          ...value,
          outside_period:
            !!value.reference_date &&
            !!row.opening_date &&
            row.includes_closing_day !== null &&
            (value.reference_date < row.opening_date ||
              value.reference_date > invoiceEnd(row)),
        })),
        history: db
          .select()
          .from(cardHistoryTable)
          .where(
            and(
              eq(cardHistoryTable.credit_card_id, row.credit_card_id),
              eq(cardHistoryTable.user_id, getActiveUser().id),
            ),
          )
          .orderBy(desc(cardHistoryTable.id))
          .all()
          .map((value) => ({
            id: value.id,
            operation: value.operation,
            created_at: value.created_at,
            changes: JSON.parse(value.changes_json) as CardHistoryChange[],
          }))
          .filter((value) =>
            value.changes.some(
              (change) =>
                (change.entity === 'invoice' && change.id === id) ||
                (change.entity === 'transaction' &&
                  (change.before?.credit_card_invoice_id === id ||
                    change.after?.credit_card_invoice_id === id)),
            ),
          ),
      };
    },
    registerInvoice(cardId: number, input: InvoiceInput): number {
      const details = validateInput(input);
      return db.transaction(() => {
        card(cardId);
        const row = db
          .insert(creditCardInvoicesTable)
          .values({
            ...details,
            credit_card_id: cardId,
            amount_cents:
              input.total_source === 'calculated' ? 0 : input.amount_cents,
          })
          .returning()
          .get()!;
        history(cardId, 'register_invoice', [snapshot('invoice', null, row)]);
        return row.id;
      });
    },
    previewCorrection(id: number, input: InvoiceInput) {
      return db.transaction(() => invoicePlan(id, input));
    },
    correctInvoice(id: number, input: InvoiceInput, token: string) {
      db.transaction(() => {
        const plan = invoicePlan(id, input);

        if (plan.token !== token) {
          throw new Error('stale_correction');
        }

        for (const change of plan.changes) {
          if (change.entity === 'invoice') {
            const after = change.after as unknown as Invoice;
            db.update(creditCardInvoicesTable)
              .set({
                opening_date: after.opening_date,
                closing_date: after.closing_date,
                due_date: after.due_date,
                includes_closing_day: after.includes_closing_day,
                total_source: after.total_source,
                amount_cents: after.amount_cents,
              })
              .where(eq(creditCardInvoicesTable.id, change.id))
              .run();
          } else {
            db.update(transactionsTable)
              .set({
                credit_card_invoice_id: Number(
                  change.after!.credit_card_invoice_id,
                ),
              })
              .where(eq(transactionsTable.id, change.id))
              .run();
          }
        }

        history(invoice(id).credit_card_id, 'correct_invoice', plan.changes);
      });
    },
    unlinked() {
      return db
        .select({
          id: transactionsTable.id,
          name: transactionsTable.name,
          note: transactionsTable.note,
          reference_date: transactionsTable.reference_date,
          amount_cents: transactionsTable.amount_cents,
          installment_number: transactionsTable.installment_number,
        })
        .from(transactionsTable)
        .innerJoin(
          paymentsTable,
          eq(paymentsTable.id, transactionsTable.payment_id),
        )
        .where(
          and(
            eq(transactionsTable.user_id, getActiveUser().id),
            eq(transactionsTable.type, 2),
            eq(paymentsTable.type, 2),
            isNull(transactionsTable.credit_card_invoice_id),
          ),
        )
        .orderBy(desc(transactionsTable.id))
        .all();
    },
    resolveInvoice,
    invoice,
    reconcile,
    previewEntry(
      before: Entry | null,
      after: Entry | null,
    ): CardCorrectionPreview {
      const id =
        before?.credit_card_invoice_id ?? after?.credit_card_invoice_id ?? null;

      if (id === null) {
        return preview([], before);
      }

      const original = invoice(id);
      const rows = items(id).filter((row) => row.id !== (before ?? after)!.id);

      if (after) {
        rows.push(after);
      }

      return preview(
        [
          snapshot('transaction', before, after),
          snapshot('invoice', original, {
            ...original,
            amount_cents:
              original.total_source === 'calculated'
                ? sum(rows)
                : original.amount_cents,
          }),
        ],
        items(id),
      );
    },
    recordEntry(
      operation: string,
      before: Entry | null,
      after: Entry | null,
      invoiceChanges: CardHistoryChange[] = [],
    ) {
      const changes = [
        snapshot('transaction', before, after),
        ...invoiceChanges,
      ];
      const ids = [
        ...new Set(
          [
            before?.credit_card_invoice_id,
            after?.credit_card_invoice_id,
          ].filter((id): id is number => typeof id === 'number'),
        ),
      ];
      const cardIds = [...new Set(ids.map((id) => invoice(id).credit_card_id))];

      for (const cardId of cardIds) {
        history(cardId, operation, changes);
      }
    },
    associate(
      id: number,
      input: InvoiceAssociationInput,
      token?: string,
    ): CardCorrectionPreview {
      return db.transaction(() => {
        const before = entry(id);
        const method = db
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, before.payment_id))
          .get();

        if (before.type !== 2 || method?.type !== 2) {
          throw new Error('invalid_credit_purchase');
        }

        // Preview must not create a period: explicit targets are required here.
        if (input.invoice_id === null) {
          throw new Error('invoice_not_found');
        }

        const target = invoice(input.invoice_id);

        if (target.credit_card_id !== input.card_id) {
          throw new Error('invalid_invoice_ownership');
        }

        const after = { ...before, credit_card_invoice_id: target.id };
        const ids = [
          ...new Set(
            [before.credit_card_invoice_id, target.id].filter(
              (value): value is number => value !== null,
            ),
          ),
        ];
        const changes = [snapshot('transaction', before, after)];

        for (const value of ids) {
          const original = invoice(value);
          const rows = items(value).filter((row) => row.id !== id);

          if (value === target.id) {
            rows.push(after);
          }

          changes.push(
            snapshot('invoice', original, {
              ...original,
              amount_cents:
                original.total_source === 'calculated'
                  ? sum(rows)
                  : original.amount_cents,
            }),
          );
        }

        const plan = preview(
          changes,
          ids.map((value) => items(value)),
        );

        if (token !== undefined) {
          if (plan.token !== token) {
            throw new Error('stale_correction');
          }

          db.update(transactionsTable)
            .set({ credit_card_invoice_id: target.id })
            .where(eq(transactionsTable.id, id))
            .run();

          for (const value of ids) {
            reconcile(value);
          }

          for (const cardId of new Set(
            ids.map((value) => invoice(value).credit_card_id),
          )) {
            history(cardId, 'associate_purchase', changes);
          }
        }

        return plan;
      });
    },
  };
}
