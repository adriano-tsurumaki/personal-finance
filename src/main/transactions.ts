import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type {
  TransactionDto,
  TransactionInput,
  TransactionUpdateInput,
} from '@shared/contracts/transaction';
import type { AppDatabase } from './db';
import {
  categoriesTable,
  creditCardInvoicesTable,
  paymentsTable,
  recurrenceOccurrencesTable,
  transactionsTable,
} from './db/schema';
import type { CreateResult } from '@shared/contracts/result';
import {
  paymentMethodsForType,
  isCreditPayment,
  isFinancedPayment,
} from '@shared/lib/payment-method';
import { financingAmounts } from '@shared/lib/credit-financing';
import { createCreditCardService } from './credit-cards';
import type { CardCorrectionPreview } from '@shared/contracts/credit-cards';

export function createTransactionService(
  db: AppDatabase,
  getActiveUser: () => { id: number },
) {
  const cards = createCreditCardService(db, getActiveUser);
  function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  function validateDetails(input: TransactionUpdateInput) {
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 200
    ) {
      throw new Error('Enter a description of up to 200 characters.');
    }

    if (input.type !== 1 && input.type !== 2) {
      throw new Error('Invalid type.');
    }

    if (
      input.note !== undefined &&
      input.note !== null &&
      typeof input.note !== 'string'
    ) {
      throw new Error('The note must be text.');
    }

    if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0) {
      throw new Error('Enter a positive amount in whole cents.');
    }

    if (!validDate(input.reference_date)) {
      throw new Error('Invalid date.');
    }

    return {
      ...(input.financing === undefined
        ? {}
        : {
            financing:
              input.financing === null
                ? null
                : financingAmounts(input.financing),
            financing_terms: input.financing ?? null,
          }),
      name: input.name.trim(),
      note: input.note === undefined ? undefined : input.note?.trim() || null,
      type: input.type,
      amount_cents: input.amount_cents,
      reference_date: input.reference_date,
    };
  }

  function validate(input: TransactionInput, userId: number) {
    const details = validateDetails(input);
    const method = db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, input.payment_id))
      .get();

    if (input.payment_date !== null && !validDate(input.payment_date)) {
      throw new Error('Invalid date.');
    }

    if (
      !Number.isSafeInteger(input.payment_id) ||
      !db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.id, input.payment_id),
            inArray(
              paymentsTable.catalog_key,
              paymentMethodsForType(input.type),
            ),
          ),
        )
        .get()
    ) {
      throw new Error('Invalid payment method.');
    }

    validateFinancing(input, method?.catalog_key);

    if (
      input.category_id !== null &&
      (!Number.isSafeInteger(input.category_id) ||
        !db
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.id, input.category_id),
              eq(categoriesTable.user_id, userId),
              isNull(categoriesTable.archived_at),
              or(
                eq(categoriesTable.transaction_type, 'both'),
                eq(
                  categoriesTable.transaction_type,
                  input.type === 1 ? 'income' : 'expense',
                ),
              ),
            ),
          )
          .get())
    ) {
      throw new Error('Invalid category.');
    }

    return {
      ...details,
      payment_date: input.payment_date,
      payment_id: input.payment_id,
      category_id: input.category_id,
    };
  }

  function validateFinancing(
    input: TransactionUpdateInput,
    method: string | null | undefined,
  ) {
    if (isFinancedPayment(method)) {
      if (
        !input.financing ||
        financingAmounts(input.financing).total_cents !== input.amount_cents ||
        input.type !== 2
      ) {
        throw new Error('invalid_financing_total');
      }
    } else if (input.financing) {
      throw new Error('invalid_financing_method');
    }
  }

  function validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid identifier.');
    }
  }

  function createPurchase(
    input: TransactionInput,
    dryRun: boolean,
  ): { plan: CardCorrectionPreview | null; id: number } {
    const rollback = {};
    let plan: CardCorrectionPreview | null = null;
    let id = 0;
    try {
      db.transaction(() => {
        const user = getActiveUser();
        const details = validate(input, user.id);
        const method = db
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, details.payment_id))
          .get()!;
        let invoiceId: number | null = null;

        if (isCreditPayment(method.catalog_key)) {
          if (!input.card_id || input.payment_date !== null) {
            throw new Error('credit_card_required');
          }

          const selected = input.invoice_month
            ? cards.resolveInvoiceMonth(
                input.card_id,
                input.invoice_month,
                input.historical_card === true,
              ).id
            : null;

          if (
            selected !== null &&
            input.credit_card_invoice_id != null &&
            selected !== input.credit_card_invoice_id
          ) {
            throw new Error('invalid_invoice');
          }

          invoiceId = cards.resolveInvoice(
            input.card_id,
            details.reference_date,
            input.credit_card_invoice_id ?? selected,
            input.historical_card === true,
          ).id;
        } else if (
          input.card_id ||
          input.credit_card_invoice_id ||
          input.invoice_month
        ) {
          throw new Error('invalid_credit_purchase');
        }

        const after = db
          .insert(transactionsTable)
          .values({
            ...details,
            user_id: user.id,
            credit_card_invoice_id: invoiceId,
          })
          .returning()
          .get()!;

        id = after.id;

        if (invoiceId !== null) {
          plan = cards.previewEntry(null, after);

          if (!dryRun && input.correction_token !== plan.token) {
            throw new Error('stale_correction');
          }

          const change = cards.reconcile(invoiceId);
          cards.recordEntry(
            'create_purchase',
            null,
            after,
            change ? [change] : [],
          );
        }

        if (dryRun) {
          // Roll back preview inserts, including generated invoices and audit records.
          throw rollback;
        }
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
    }

    return { plan, id };
  }

  return {
    validateInput(input: TransactionInput) {
      return validate(input, getActiveUser().id);
    },
    list(month: string): TransactionDto[] {
      const user = getActiveUser();

      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error('Invalid month.');
      }

      return (
        db
          .select({
            financing: transactionsTable.financing,
            payment_method: paymentsTable.catalog_key,
            id: transactionsTable.id,
            name: transactionsTable.name,
            note: transactionsTable.note,
            amount_cents: transactionsTable.amount_cents,
            type: transactionsTable.type,
            reference_date: transactionsTable.reference_date,
            payment_date: transactionsTable.payment_date,
            payment_id: transactionsTable.payment_id,
            credit_card_invoice_id: transactionsTable.credit_card_invoice_id,
            invoice_paid_at: creditCardInvoicesTable.paid_at,
            installment_id: transactionsTable.installment_id,
            installment_number: transactionsTable.installment_number,
            total_installments: sql<
              number | null
            >`(SELECT total_installments FROM installment WHERE id = ${transactionsTable.installment_id} AND user_id = ${user.id})`,
            category: {
              id: categoriesTable.id,
              name: categoriesTable.name,
              icon_key: categoriesTable.icon_key,
              color: categoriesTable.color,
              catalog_key: categoriesTable.catalog_key,
            },
          })
          .from(transactionsTable)
          .innerJoin(
            paymentsTable,
            eq(paymentsTable.id, transactionsTable.payment_id),
          )
          .leftJoin(
            creditCardInvoicesTable,
            and(
              eq(
                creditCardInvoicesTable.id,
                transactionsTable.credit_card_invoice_id,
              ),
              sql`EXISTS (SELECT 1 FROM credit_cards c WHERE c.id = ${creditCardInvoicesTable.credit_card_id} AND c.user_id = ${user.id})`,
            ),
          )
          .leftJoin(
            categoriesTable,
            eq(categoriesTable.id, transactionsTable.category_id),
          )
          .where(
            and(
              eq(transactionsTable.user_id, user.id),
              gte(transactionsTable.reference_date, `${month}-01`),
              lt(
                transactionsTable.reference_date,
                sql`date(${`${month}-01`}, '+1 month')`,
              ),
            ),
          )
          .orderBy(
            desc(transactionsTable.reference_date),
            desc(transactionsTable.id),
          )
          .all()
          // The month predicate excludes legacy entries without a reference date.
          .map((row) => ({ ...row, reference_date: row.reference_date! }))
      );
    },

    get(id: number): TransactionInput {
      const user = getActiveUser();
      validateId(id);
      const result = db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, user.id),
          ),
        )
        .get();

      if (!result) {
        throw new Error('Transaction not found.');
      }

      return {
        ...(result.financing_terms
          ? { financing: result.financing_terms }
          : result.financing
            ? {
                financing: {
                  principal_cents: result.financing.principal_cents,
                  interest: {
                    mode: 'amount' as const,
                    value: result.financing.interest_cents,
                  },
                  iof: {
                    mode: 'amount' as const,
                    value: result.financing.iof_cents,
                  },
                },
              }
            : {}),
        name: result.name,
        ...(result.installment_id === null
          ? {}
          : { installment_id: result.installment_id }),
        note: result.note,
        type: result.type,
        amount_cents: result.amount_cents,
        reference_date: result.reference_date ?? '',
        payment_date: result.payment_date,
        payment_id: result.payment_id,
        category_id: result.category_id,
        user_id: result.user_id,
        ...(result.credit_card_invoice_id === null
          ? {}
          : {
              credit_card_invoice_id: result.credit_card_invoice_id,
              card_id: cards.invoice(result.credit_card_invoice_id)
                .credit_card_id,
            }),
      };
    },

    create(input: TransactionInput): CreateResult {
      createPurchase(input, false);
      return { ok: true };
    },
    createWithId(input: TransactionInput): number {
      return createPurchase(input, false).id;
    },
    previewCreate(input: TransactionInput): CardCorrectionPreview | null {
      return createPurchase(input, true).plan;
    },

    previewUpdate(id: number, input: TransactionUpdateInput) {
      const details = validateDetails(input);
      const before = db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, getActiveUser().id),
          ),
        )
        .get();

      if (!before) {
        throw new Error('Transaction not found.');
      }

      validateFinancing(
        {
          ...input,
          financing:
            input.financing === undefined
              ? before.financing_terms
              : input.financing,
        },
        db
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, before.payment_id))
          .get()?.catalog_key,
      );

      if (before.installment_id !== null) {
        throw new Error('installment_managed');
      }

      return cards.previewEntry(before, {
        ...before,
        ...details,
        note: details.note === undefined ? before.note : details.note,
      });
    },
    previewRemove(id: number) {
      const before = db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, id),
            eq(transactionsTable.user_id, getActiveUser().id),
          ),
        )
        .get();

      if (!before) {
        throw new Error('Transaction not found.');
      }

      if (before.installment_id !== null) {
        throw new Error('installment_managed');
      }

      return cards.previewEntry(before, null);
    },
    update(id: number, input: TransactionUpdateInput): CreateResult {
      return db.transaction(() => {
        const user = getActiveUser();
        validateId(id);
        const details = validateDetails(input);
        const existing = db
          .select()
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.id, id),
              eq(transactionsTable.user_id, user.id),
            ),
          )
          .get();

        if (!existing) {
          throw new Error('Transaction not found.');
        }

        validateFinancing(
          {
            ...input,
            financing:
              input.financing === undefined
                ? existing.financing_terms
                : input.financing,
          },
          db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.id, existing.payment_id))
            .get()?.catalog_key,
        );

        if (existing.installment_id !== null) {
          throw new Error('installment_managed');
        }

        if (existing.credit_card_invoice_id !== null) {
          if (input.type !== 2) {
            throw new Error('invalid_credit_purchase');
          }

          const plan = cards.previewEntry(existing, {
            ...existing,
            ...details,
            note: details.note === undefined ? existing.note : details.note,
          });

          if (input.correction_token !== plan.token) {
            throw new Error('stale_correction');
          }
        }

        if (
          existing.type !== input.type &&
          !db
            .select({ id: paymentsTable.id })
            .from(paymentsTable)
            .where(
              and(
                eq(paymentsTable.id, existing.payment_id),
                inArray(
                  paymentsTable.catalog_key,
                  paymentMethodsForType(input.type),
                ),
              ),
            )
            .get()
        ) {
          throw new Error('Invalid payment method for this transaction type.');
        }

        const result = db
          .update(transactionsTable)
          .set(details)
          .where(
            and(
              eq(transactionsTable.id, id),
              eq(transactionsTable.user_id, user.id),
            ),
          )
          .run();

        if (!result.changes) {
          throw new Error('Transaction not found.');
        }

        if (existing.credit_card_invoice_id !== null) {
          const after = db
            .select()
            .from(transactionsTable)
            .where(eq(transactionsTable.id, id))
            .get()!;
          const change = cards.reconcile(existing.credit_card_invoice_id);
          cards.recordEntry(
            'update_purchase',
            existing,
            after,
            change ? [change] : [],
          );
        }

        return { ok: true };
      });
    },

    remove(id: number, token?: string) {
      db.transaction(() => {
        const user = getActiveUser();
        validateId(id);
        const before = db
          .select()
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.id, id),
              eq(transactionsTable.user_id, user.id),
            ),
          )
          .get();

        if (!before) {
          throw new Error('Transaction not found.');
        }

        if (before.installment_id !== null) {
          throw new Error('installment_managed');
        }

        if (
          before.credit_card_invoice_id !== null &&
          token !== cards.previewEntry(before, null).token
        ) {
          throw new Error('stale_correction');
        }

        db.update(recurrenceOccurrencesTable)
          .set({ state: 'ignored', transaction_id: null })
          .where(eq(recurrenceOccurrencesTable.transaction_id, id))
          .run();

        const result = db
          .delete(transactionsTable)
          .where(
            and(
              eq(transactionsTable.id, id),
              eq(transactionsTable.user_id, user.id),
            ),
          )
          .run();

        if (!result.changes) {
          throw new Error('Transaction not found.');
        }

        if (before.credit_card_invoice_id !== null) {
          const change = cards.reconcile(before.credit_card_invoice_id);
          cards.recordEntry(
            'delete_purchase',
            before,
            null,
            change ? [change] : [],
          );
        }
      });
    },
  };
}
