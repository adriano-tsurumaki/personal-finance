import { createHash } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from './db';
import {
  installmentRequestsTable,
  installmentsTable,
  paymentsTable,
  transactionsTable,
} from './db/schema';
import type {
  InstallmentInput,
  InstallmentPlanDto,
  InstallmentPreviewDto,
} from '@shared/contracts/installment';
import { createCreditCardService } from './credit-cards';
import { createTransactionService } from './transactions';
import {
  addCalendarDays,
  validCalendarDate,
} from './credit-cards/billing-cycle';
import {
  installmentDateAt,
  installmentSchedule,
} from './installments/schedule';

export function createInstallmentService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const cards = createCreditCardService(db, getActiveUser);
  const transactions = createTransactionService(db, getActiveUser);
  function planRow(id: number) {
    const row = db
      .select()
      .from(installmentsTable)
      .where(
        and(
          eq(installmentsTable.id, id),
          eq(installmentsTable.user_id, getActiveUser().id),
        ),
      )
      .get();

    if (!Number.isSafeInteger(id) || !row) {
      throw new Error('installment_not_found');
    }

    return row;
  }
  function entries(id: number) {
    return db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.installment_id, id))
      .orderBy(asc(transactionsTable.installment_number))
      .all();
  }
  function details(
    id: number,
    draftSchedule?: InstallmentInput & { reference_dates: string[] },
  ): InstallmentPlanDto {
    const group = planRow(id);
    const rows = entries(id);
    let repair =
      rows.length !== group.total_installments ||
      rows.length < 2 ||
      rows.some((row) => row.user_id !== group.user_id);
    let expected: ReturnType<typeof installmentSchedule> = [];
    let firstCard: number | undefined;
    const savedInput = db
      .select()
      .from(installmentRequestsTable)
      .where(
        and(
          eq(installmentRequestsTable.installment_id, id),
          eq(installmentRequestsTable.user_id, group.user_id),
        ),
      )
      .get();
    const savedSchedule =
      draftSchedule ??
      (savedInput
        ? (JSON.parse(savedInput.input_json) as InstallmentInput & {
            reference_dates?: string[];
          })
        : null);
    try {
      expected = installmentSchedule(
        group.total_amount_cents,
        group.total_installments,
        group.start_date,
      );
    } catch {
      repair = true;
    }
    const result = rows
      .filter((row) => row.user_id === group.user_id)
      .map((row, index) => {
        let invoice = null;
        const method = db
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, row.payment_id))
          .get();
        try {
          invoice =
            row.credit_card_invoice_id === null
              ? null
              : cards.invoiceSummary(row.credit_card_invoice_id);
        } catch {
          repair = true;
        }

        if (index === 0) {
          firstCard = invoice?.credit_card_id;
        }

        if (
          row.user_id !== group.user_id ||
          row.type !== 2 ||
          row.recurrence_version_id !== null ||
          row.installment_number !== index + 1 ||
          row.reference_date !==
            (savedSchedule?.reference_dates?.[index] ??
              expected[index]?.reference_date) ||
          row.amount_cents !==
            (savedSchedule?.installment_amounts_cents?.[index] ??
              expected[index]?.amount_cents) ||
          !method ||
          (method.catalog_key === 'credit'
            ? !invoice || row.payment_date !== null
            : method.type !== 1 || invoice !== null) ||
          row.payment_id !== rows[0]?.payment_id ||
          row.category_id !== rows[0]?.category_id ||
          row.name !== group.name ||
          row.note !== rows[0]?.note ||
          invoice?.credit_card_id !== firstCard
        ) {
          repair = true;
        }

        return {
          id: row.id,
          installment_number: row.installment_number ?? 0,
          reference_date: row.reference_date ?? '',
          amount_cents: row.amount_cents,
          payment_date: row.payment_date,
          invoice,
        };
      });

    if (
      !validCalendarDate(group.purchase_at) ||
      group.purchase_at > group.start_date ||
      group.end_date !==
        (savedSchedule?.reference_dates?.at(-1) ??
          expected.at(-1)?.reference_date) ||
      !Number.isSafeInteger(group.total_amount_cents) ||
      rows.some(
        (row) =>
          !Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0,
      ) ||
      (rows.every((row) => Number.isSafeInteger(row.amount_cents)) &&
        rows.reduce((sum, row) => sum + BigInt(row.amount_cents), 0n) !==
          BigInt(group.total_amount_cents))
    ) {
      repair = true;
    }

    return {
      ...group,
      note: rows.find((row) => row.user_id === group.user_id)?.note ?? null,
      repair_required: repair,
      entries: result,
    };
  }
  function normalize(input: InstallmentInput): InstallmentInput {
    if (
      !input ||
      typeof input.request_id !== 'string' ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(input.request_id) ||
      !validCalendarDate(input.purchase_at) ||
      !validCalendarDate(input.start_date) ||
      input.purchase_at > input.start_date ||
      !Array.isArray(input.invoice_ids) ||
      input.invoice_ids.length > input.total_installments ||
      input.invoice_ids.some(
        (id) => id !== null && (!Number.isSafeInteger(id) || id <= 0),
      ) ||
      (input.card_id !== null &&
        (!Number.isSafeInteger(input.card_id) || input.card_id <= 0)) ||
      typeof input.historical_card !== 'boolean'
    ) {
      throw new Error('invalid_installment');
    }

    installmentSchedule(
      input.total_amount_cents,
      input.total_installments,
      input.start_date,
    );
    const amounts = input.installment_amounts_cents ?? [];

    if (
      !Array.isArray(amounts) ||
      (amounts.length !== 0 &&
        (amounts.length !== input.total_installments ||
          amounts.some(
            (amount) => !Number.isSafeInteger(amount) || amount <= 0,
          ) ||
          amounts.reduce((sum, amount) => sum + BigInt(amount), 0n) !==
            BigInt(input.total_amount_cents))) ||
      (input.use_invoice_opening_date !== undefined &&
        typeof input.use_invoice_opening_date !== 'boolean') ||
      (input.add_day_to_invoice_opening_date !== undefined &&
        typeof input.add_day_to_invoice_opening_date !== 'boolean') ||
      (input.add_day_to_invoice_opening_date === true &&
        input.use_invoice_opening_date !== true) ||
      (input.use_invoice_opening_date === true && input.card_id === null)
    ) {
      throw new Error('invalid_installment_allocation');
    }

    const value = transactions.validateInput({
      name: input.name,
      note: input.note,
      type: 2,
      amount_cents: input.total_amount_cents,
      reference_date: input.start_date,
      payment_date: null,
      payment_id: input.payment_id,
      category_id: input.category_id,
      user_id: getActiveUser().id,
    });
    const method = db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, value.payment_id))
      .get()!;

    if (method.catalog_key !== 'credit' || input.card_id === null) {
      throw new Error('installment_credit_required');
    }

    return {
      request_id: input.request_id,
      name: value.name,
      note: value.note ?? null,
      total_amount_cents: value.amount_cents,
      total_installments: input.total_installments,
      purchase_at: input.purchase_at,
      start_date: input.start_date,
      payment_id: value.payment_id,
      category_id: value.category_id,
      card_id: input.card_id,
      historical_card: input.historical_card,
      installment_amounts_cents: amounts,
      use_invoice_opening_date: input.use_invoice_opening_date ?? false,
      add_day_to_invoice_opening_date:
        input.add_day_to_invoice_opening_date ?? false,
      invoice_ids: Array.from(
        { length: input.total_installments },
        (_, i) => input.invoice_ids[i] ?? null,
      ),
    };
  }
  function receipt(request: string) {
    return db
      .select()
      .from(installmentRequestsTable)
      .where(
        and(
          eq(installmentRequestsTable.user_id, getActiveUser().id),
          eq(installmentRequestsTable.request_id, request),
        ),
      )
      .get();
  }
  function token(value: unknown) {
    return createHash('sha256')
      .update(
        JSON.stringify(value, (_key, item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(
                Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
              )
            : item,
        ),
      )
      .digest('hex');
  }
  function createPlan(
    input: InstallmentInput,
    confirmation?: string,
  ): InstallmentPreviewDto {
    const rollback = {};
    let result!: InstallmentPreviewDto;
    try {
      db.transaction(() => {
        const value = normalize(input);

        if (receipt(value.request_id)) {
          throw new Error('installment_request_conflict');
        }

        const schedule = installmentSchedule(
          value.total_amount_cents,
          value.total_installments,
          value.start_date,
        );
        let group = db
          .insert(installmentsTable)
          .values({
            name: value.name,
            total_amount_cents: value.total_amount_cents,
            total_installments: value.total_installments,
            start_date: value.start_date,
            end_date: schedule.at(-1)!.reference_date,
            purchase_at: value.purchase_at,
            user_id: getActiveUser().id,
          })
          .returning()
          .get()!;
        let firstClosing: string | null = null;
        let previousDate = value.start_date;
        const rows = schedule.map((slot, index) => {
          let invoiceId: number | null = null;
          let referenceDate = slot.reference_date;

          if (value.card_id !== null) {
            let selected = value.invoice_ids[index];

            if (index > 0 && selected === null) {
              const month = installmentDateAt(
                `${firstClosing!}-01`,
                index,
              ).slice(0, 7);
              const matches = cards
                .invoices(value.card_id)
                .filter((row) => row.closing_date.slice(0, 7) === month);

              if (matches.length > 1) {
                throw new Error('ambiguous_invoice');
              }

              selected = matches[0]?.id ?? null;

              if (selected === null) {
                const period = cards.previewPeriod(value.card_id, month);
                selected = cards.resolveInvoice(
                  value.card_id,
                  period.opening_date,
                  null,
                  value.historical_card,
                ).id;
              }
            }

            const invoice = cards.resolveInvoice(
              value.card_id,
              value.purchase_at,
              selected,
              value.historical_card,
            );

            if (index === 0) {
              firstClosing = invoice.closing_date.slice(0, 7);
            } else if (
              invoice.closing_date.slice(0, 7) !==
              installmentDateAt(`${firstClosing!}-01`, index).slice(0, 7)
            ) {
              throw new Error('invalid_installment_invoices');
            }

            invoiceId = invoice.id;

            if (index > 0 && value.use_invoice_opening_date) {
              if (
                !invoice.opening_date ||
                !validCalendarDate(invoice.opening_date)
              ) {
                throw new Error('invalid_installment_invoice_dates');
              }

              referenceDate = addCalendarDays(
                invoice.opening_date,
                value.add_day_to_invoice_opening_date ? 1 : 0,
              );

              if (referenceDate <= previousDate) {
                throw new Error('invalid_installment_invoice_dates');
              }
            }
          }

          previousDate = referenceDate;

          return db
            .insert(transactionsTable)
            .values({
              ...slot,
              amount_cents:
                value.installment_amounts_cents?.[index] ?? slot.amount_cents,
              reference_date: referenceDate,
              name: value.name,
              note: value.note,
              type: 2,
              payment_date: null,
              payment_id: value.payment_id,
              category_id: value.category_id,
              user_id: getActiveUser().id,
              installment_id: group.id,
              credit_card_invoice_id: invoiceId,
            })
            .returning()
            .get()!;
        });
        group = db
          .update(installmentsTable)
          .set({ end_date: rows.at(-1)!.reference_date! })
          .where(eq(installmentsTable.id, group.id))
          .returning()
          .get()!;
        const correction = cards.previewBatch([], rows);
        correction.token = token({ value, group, correction });

        for (const id of new Set(
          rows.flatMap((row) =>
            row.credit_card_invoice_id === null
              ? []
              : [row.credit_card_invoice_id],
          ),
        )) {
          cards.reconcile(id);
        }

        result = {
          plan: details(group.id, {
            ...value,
            reference_dates: rows.map((row) => row.reference_date!),
          }),
          correction,
        };

        if (confirmation === undefined) {
          throw rollback;
        }

        if (confirmation !== correction.token) {
          throw new Error('stale_correction');
        }

        cards.recordBatch('create_installment_plan', correction.changes);
        db.insert(installmentRequestsTable)
          .values({
            user_id: getActiveUser().id,
            request_id: value.request_id,
            input_json: JSON.stringify({
              ...value,
              reference_dates: rows.map((row) => row.reference_date),
            }),
            installment_id: group.id,
          })
          .run();
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
    }

    return result;
  }
  function deletion(id: number): InstallmentPreviewDto {
    const plan = details(id);

    if (plan.repair_required) {
      throw new Error('installment_repair_required');
    }

    if (
      plan.entries.some(
        (row) => row.payment_date !== null || row.invoice?.paid_at,
      )
    ) {
      throw new Error('installment_paid');
    }

    const correction = cards.previewBatch(entries(id), []);
    correction.token = token({ plan, correction });
    return { plan, correction };
  }
  return {
    list(): InstallmentPlanDto[] {
      return db.transaction(() =>
        db
          .select({ id: installmentsTable.id })
          .from(installmentsTable)
          .where(eq(installmentsTable.user_id, getActiveUser().id))
          .all()
          .map((row) => details(row.id)),
      );
    },
    preview(input: InstallmentInput) {
      return createPlan(input);
    },
    create(input: InstallmentInput, confirmation: string): number {
      return db.transaction(() => {
        if (typeof confirmation !== 'string' || !confirmation) {
          throw new Error('stale_correction');
        }

        // A committed receipt must remain retryable even if catalogs were archived afterward.
        const previous =
          input && typeof input.request_id === 'string'
            ? receipt(input.request_id)
            : undefined;

        if (previous) {
          const storedValue = JSON.parse(
            previous.input_json,
          ) as InstallmentInput & { reference_dates?: string[] };
          delete storedValue.reference_dates;
          const stored = {
            ...storedValue,
            installment_amounts_cents:
              storedValue.installment_amounts_cents ?? [],
            use_invoice_opening_date:
              storedValue.use_invoice_opening_date ?? false,
            add_day_to_invoice_opening_date:
              storedValue.add_day_to_invoice_opening_date ?? false,
          };
          const candidate = {
            ...Object.fromEntries(
              Object.keys(stored).map((key) => [
                key,
                input[key as keyof InstallmentInput],
              ]),
            ),
            name: input.name?.trim(),
            note: input.note?.trim() || null,
            installment_amounts_cents: input.installment_amounts_cents ?? [],
            use_invoice_opening_date: input.use_invoice_opening_date ?? false,
            add_day_to_invoice_opening_date:
              input.add_day_to_invoice_opening_date ?? false,
            invoice_ids: Array.from(
              { length: stored.total_installments },
              (_, i) => input.invoice_ids?.[i] ?? null,
            ),
          };

          if (
            !Array.isArray(input.invoice_ids) ||
            input.invoice_ids.length > stored.total_installments ||
            token(candidate) !== token(stored) ||
            previous.installment_id === null
          ) {
            throw new Error('installment_request_conflict');
          }

          return previous.installment_id;
        }

        return createPlan(input, confirmation).plan.id;
      });
    },
    rename(id: number, name: string, note: string | null) {
      db.transaction(() => {
        const plan = details(id);

        if (plan.repair_required) {
          throw new Error('installment_repair_required');
        }

        if (
          typeof name !== 'string' ||
          !name.trim() ||
          name.trim().length > 200 ||
          (note !== null && typeof note !== 'string')
        ) {
          throw new Error('invalid_installment');
        }

        const before = entries(id);
        db.update(installmentsTable)
          .set({ name: name.trim() })
          .where(eq(installmentsTable.id, id))
          .run();
        db.update(transactionsTable)
          .set({ name: name.trim(), note: note?.trim() || null })
          .where(eq(transactionsTable.installment_id, id))
          .run();

        for (const row of entries(id)) {
          cards.recordEntry(
            'rename_installment_plan',
            before.find((old) => old.id === row.id)!,
            row,
          );
        }
      });
    },
    previewRemove(id: number) {
      return db.transaction(() => deletion(id));
    },
    remove(id: number, confirmation: string) {
      db.transaction(() => {
        const proposal = deletion(id);

        if (confirmation !== proposal.correction.token) {
          throw new Error('stale_correction');
        }

        const rows = entries(id);
        db.delete(transactionsTable)
          .where(
            inArray(
              transactionsTable.id,
              rows.map((row) => row.id),
            ),
          )
          .run();

        for (const invoiceId of new Set(
          rows.flatMap((row) =>
            row.credit_card_invoice_id === null
              ? []
              : [row.credit_card_invoice_id],
          ),
        )) {
          cards.reconcile(invoiceId);
        }

        cards.recordBatch(
          'delete_installment_plan',
          proposal.correction.changes,
        );
        db.update(installmentRequestsTable)
          .set({ installment_id: null })
          .where(eq(installmentRequestsTable.installment_id, id))
          .run();
        db.delete(installmentsTable).where(eq(installmentsTable.id, id)).run();
      });
    },
  };
}
