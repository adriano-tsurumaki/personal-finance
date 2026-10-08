# Future improvements and pending work

This document complements the [data model](data-model.md) and [project structure conventions](project-structure.md). It separates deferred features from technical work needed to consolidate the first version.

## Tracking rules

Keep concrete implementation gaps here rather than in the structure guide. When a task touches an affected area, inspect the relevant code and update the item after checking its completion criteria. Do not treat an existing note as proof that work is still pending, or close an item based only on a rename or type declaration. Completed checklist items should include the verification date and a short description of the evidence. Work outside the requested scope remains deferred.

## Structure follow-up

The following items were checked against the working tree on 2026-09-18. They are scoped follow-ups, not prerequisites for unrelated tasks.

- [ ] Move the preload API interface from `src/shared/types.ts` into a subject-specific file in `src/shared/contracts/`. Complete when its consumers, including the `Window` declaration, import the contract from that location and type checking passes. Transaction DTOs already live in contracts and do not need this migration.
- [ ] Consolidate UI entry points, markup, and styles under `src/renderer` during a relevant UI organization task. Inspect `src/ts`, `src/html`, `src/titlebar`, `src/renderer.ts`, and `src/index.css` when planning the move. Complete when affected imports and Electron/Vite entry paths resolve to the new locations, the build passes, and both application and titlebar load correctly.

## Deferred features

### Transaction form integration

- Replace fixed category, user, and payment identifiers with the appropriate
  process contracts and persisted associations. Deferred by request on 2026-10-08.
- [x] Use the reference date in the transaction form (verified 2026-10-08):
      the date picker and submitted input update `reference_date`. New entries have
      `payment_date: null`; editing preserves the existing settlement date. The
      timeline already displays and filters by reference date.
- Define an explicit direct-entry settlement workflow. Payment recording remains
  deferred; editing the reference date must not record or change settlement.
- Implement the monthly statement IPC API already declared by the renderer.
  Timeline mutations refresh their own entries; monthly financial indicators
  cannot refresh until this API is implemented.

### Multiple invoice payments

Invoices currently use one full payment in `credit_card_invoice.paid_at`. A future `invoice_payments` table could store `invoice_id`, `amount_cents`, `paid_at`, and an optional source account. Paid and outstanding totals would then be derived from those records.

Existing paid invoices could migrate to one historical payment record without duplicating cash outflows. Financing an outstanding balance would additionally require interest, fee, and billing rules.

### Per-card closing and due-date rules

The initial rule closes invoices on the last day of the month and makes them due seven calendar days later. A future version may store configurable rules in `credit_cards`.

The design must cover fixed days, month lengths, purchases on the closing day, weekends, and holidays. Concrete dates should remain on each invoice so configuration changes do not rewrite history.

### Cascade deletion review

Review each relationship and choose whether to block deletion, archive records, or clear optional references. The chosen behavior must preserve financial history while allowing legitimate corrections.

### Case-insensitive category uniqueness

Prevent duplicate category names for the same user regardless of case, while preserving the user's spelling for display. Application validation and the database uniqueness rule must use the same comparison, including accented characters. Existing duplicates must be resolved before adding the constraint.

## Work needed for the first version

### Dates and entry identity

- Require a reference date for every transaction.
- Standardize stored dates and document each field's meaning.
- Implement the closing and due-date rule, including purchases on the closing day.
- Define `transactions.type`, `payments.type`, and monetary sign conventions.

### Values and relationships

- Decide whether invoice totals are stored or calculated. Update stored totals atomically.
- Ensure installment numbers stay within the declared count and amounts add up to the purchase total.
- Keep installment start and end dates consistent or derive them.
- Ensure related categories, invoices, recurrences, and installment groups belong to the same user.
- Validate compatibility between payment methods and invoice associations.

### Database evolution and integration

- [x] Add versioned schema migrations (verified 2026-09-21): Drizzle generates SQL and snapshots; startup applies pending migrations. Integration tests verify legacy adoption, subsequent schema changes, repeat runs, and failure rollback.
- Keep shared types and database consumers aligned with schema changes.
- Prevent queries from counting both card purchases and invoice payments as cash outflows.
- Generate installments and recurring occurrences idempotently.

## Discussed possibilities

### Accounts and money sources

An accounts table could track balances and identify the source of invoice payments. `payments` describes methods and does not replace a bank account. If account tracking is adopted, receipts and payments will need account relationships.

### Consumption and cash-flow views

The application may offer separate category-based consumption analysis and cash-flow reporting. Each view must state its meaning clearly, and consumption views must not treat invoice payment as a new purchase.

### Original installment-purchase event

If the timeline needs both the full purchase event and its installments, derive the original event from `installment`. Do not create another transaction for the full amount.
