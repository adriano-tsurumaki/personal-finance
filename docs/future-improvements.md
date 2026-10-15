# Future improvements and pending work

This document complements the [data model](data-model.md) and [project structure conventions](project-structure.md). It separates deferred features from technical work needed to consolidate the first version.

## Tracking rules

Keep concrete implementation gaps here rather than in the structure guide. When a task touches an affected area, inspect the relevant code and update the item after checking its completion criteria. Do not treat an existing note as proof that work is still pending, or close an item based only on a rename or type declaration. Completed checklist items should include the verification date and a short description of the evidence. Work outside the requested scope remains deferred.

## Structure follow-up

The following items were checked against the working tree on 2026-09-18. They are scoped follow-ups, not prerequisites for unrelated tasks.

- [x] Move the preload API interface into `src/shared/contracts/api.ts` (verified 2026-10-08): the `Window` declaration imports the subject-specific contract, profile IPC uses shared DTOs, and type checking passes.
- [ ] Consolidate UI entry points, markup, and styles under `src/renderer` during a relevant UI organization task. Inspect `src/ts`, `src/html`, `src/titlebar`, `src/renderer.ts`, and `src/index.css` when planning the move. Complete when affected imports and Electron/Vite entry paths resolve to the new locations, the build passes, and both application and titlebar load correctly.

## Deferred features

### Recurrence projections and confirmation

Implemented and verified on 2026-10-14; see [Recurrences](recurrences.md). The vault's
`Personal Finance/recurrence-tasks.md` retains the detailed task and evidence log.

- [x] Resolve the documented credit-projection reconciliation policy for paid and
      statement-recorded invoices, and explicitly adopt or revise the recommended
      calendar, resume, ignore/restore, and first-occurrence defaults.
      Verified 2026-10-14: explicit coverage and unavailable-summary tests cover
      authoritative totals, due/paid dates, and prior unaffected months.
- [x] Implement compatible migrations, versioned transaction defaults, immutable
      occurrence identity across default changes, and persistent sparse decisions.
      Preserve legacy associations and handle ambiguous occurrence mapping explicitly.
      Verified 2026-10-14: additive upgrade, repeat migration, foreign keys, unique
      decisions, non-overlap, and legacy provenance tests pass.
- [x] Compute read-only monthly and cumulative projections, including card due-date
      attribution, shared timeline/statement rules, safe cents, and cache invalidation.
      Complete when distant-month navigation writes no transactions or invoices and
      accumulated estimates do not duplicate confirmed or ignored slots.
      Verified 2026-10-14: snapshot/statement tests and reference enumeration agree;
      millions of historical credit slots use bounded billing callbacks.
- [x] Implement idempotent confirmation with occurrence-specific amount, category,
      and method/card overrides, inclusive pause/end, and resume without deleting
      confirmed history. Recording payment remains a separate workflow.
      Verified 2026-10-14: rollback, moved/deleted confirmations, stale edits,
      preserved future confirmations, and resumed-gap tests pass.
- [x] Build the Ledger recurrence screen with **In month** and **All recurrences**,
      paused-rule resume access, and period notices linking from the timeline.
      Confirmed occurrences retain their scheduled month when transactions move.
      Verified 2026-10-14: localized SSR tests and isolated browser checks cover
      inline creation, moved confirmations, both themes, and forecast layout.
- [x] Integrate financial-operation ownership, coordinated refresh, profile resets,
      localized feedback, accessibility, and regression coverage. Reuse the existing
      navigation and unavailable-data behavior rather than reopening completed work.
      Verified 2026-10-14: operation/session/refresh tests and browser keyboard-tab,
      initial focus, focus-restoration, and narrow-layout checks pass. Shared
      controls retain their reduced-motion overrides.

- Creating a recurrence from an existing transaction remains a future workflow.
  New rules start unconfirmed; no matching by mutable transaction fields is used.

- [ ] Align pre-confirmation coverage availability for invoices paid before a
      recurrence's scheduled month. Verified 2026-10-15: the scheduled-date query
      horizon can omit a later slot from the earlier payment month's coverage
      check, while a later query reports the unresolved coverage. Complete when
      coverage availability follows one explicit policy across both months,
      including unknown, included, and excluded coverage. Confirmation replacement
      itself is covered by regression tests: the estimate is suppressed, the
      invoice is counted once, and its payment date determines cash-flow placement.

### Transaction form integration

- [x] Replace fixed category, user, and payment identifiers (verified 2026-10-08):
      the form loads persisted profile options through IPC, submits the active profile,
      and selects catalog methods. Main derives ownership from the active profile;
      database tests verify cross-profile isolation and catalog validation.
- [x] Filter payment methods by transaction type (verified 2026-10-09): income
      accepts PIX, cash, and bank transfer; expenses accept PIX, cash, debit, and
      credit. The form clears incompatible selections. SQLite tests cover main
      validation on creation and type changes, historical associations, automatic
      catalog initialization for existing profiles, and bank-transfer summaries.
- [x] Use the reference date in the transaction form (verified 2026-10-08):
      the date picker and submitted input update `reference_date`. New entries have
      `payment_date: null`; editing preserves the existing settlement date. The
      timeline already displays and filters by reference date. Direct income
      without a receipt date also contributes to the summary by reference date
      (verified 2026-10-09 with SQLite regression tests).
      Direct expenses without a payment date use the same reporting fallback
      (verified 2026-10-13 with SQLite regression tests for PIX, cash, debit,
      explicit payment dates, and credit exclusion).
- Define an explicit direct-entry settlement workflow for pending expenses and
  scheduled income. Direct income and expenses currently use their reference date
  when there is no explicit settlement date. Payment recording remains deferred; editing the
  reference date must not record or change stored settlement.
- [x] Implement the monthly statement IPC API (verified 2026-10-08): preload and
      main expose monthly cash flow for the active profile. SQLite regression tests
      verify settlement dates, invoice exclusion, profile isolation, indexed date
      ranges, cache reuse, and invalidation after local and external writes. Existing
      timeline mutation refreshes can now reload the monthly indicators.

### Monthly summary loading and failure states

- [x] Restore explicit loading and failure feedback for the monthly summary
      (verified 2026-10-14): navigation publishes the period, timeline, and summary
      together only after both requests succeed. Failed navigation preserves the
      confirmed period and offers retry; initial failure and failed refresh show
      unavailable amounts. Store regression tests cover both request failures,
      recovery, overlapping requests, lock release, and session isolation. Rendered
      markup tests cover unavailable amounts and confirm feedback does not change
      the summary layout. Notification lifecycle tests verify non-dismissible
      loading, error retry, cleanup on state changes, and no success notification.
- [x] Carry projected cash flow across months (verified 2026-10-14): SQLite tests
      cover empty months, year boundaries, negative balances, historical edits and
      deletion, explicit settlement dates, invoice projections, profile isolation,
      integer-cent precision, indexed aggregation of 12,000 historical events, cache
      reuse, and LRU eviction. The UI exposes the opening balance under the closing
      balance. DTO identifier and unused cash-flow event count were removed.
- Define an explicit initial cash adjustment if users need to start with money
  predating their recorded history. The current cumulative projection assumes zero
  before the first recorded event; this does not require account tracking.

### Profile and localization follow-up

- [x] Clear financial UI state across profile sessions (verified 2026-10-08):
      regression tests cover pending edits, submissions, confirmations, catalogs,
      and locale responses, including reentry into the same profile.
- [x] Separate transaction creation and editing (verified 2026-10-08): edit dialogs
      omit category and payment selectors, and database regression tests verify
      that main preserves historical classification and settlement during updates.

- Complete I18N-01 coverage for process-owned surfaces (including titlebar controls),
  calendar accessibility labels, and any remaining application-owned messages.
  Profile creation, entry, financial sections, transaction forms, timeline amounts,
  and profile catalogs already use the scoped JSON catalog foundation.
- Expand monetary paste rules for grouped or currency-prefixed values as part of
  TX-01. Current entry accepts ungrouped digits and the saved locale's decimal
  separator; invalid formats are displayed and cannot be submitted.
- Define `pix_credit` before adding it to the predefined payment catalog.
- UI composition and global styles now live in `src/renderer`; the legacy entry
  wrappers, HTML, and titlebar still need the remaining entry-point consolidation.

### Multiple invoice payments

Invoices currently use one full payment in `credit_card_invoice.paid_at`. A future `invoice_payments` table could store `invoice_id`, `amount_cents`, `paid_at`, and an optional source account. Paid and outstanding totals would then be derived from those records.

Existing paid invoices could migrate to one historical payment record without duplicating cash outflows. Financing an outstanding balance would additionally require interest, fee, and billing rules.

### Card billing cycles and historical invoices

- Initial per-card closing settings, closing-day inclusion, calendar-day due
  offsets, historical invoice entry, independent navigation, statement totals,
  and audited corrections are implemented in CARD-01. Verification includes
  SQLite regression tests and isolated browser checks; see the data model.
- Changing an existing card's recurring rules remains deferred to CARD-02.
  Analyze effective boundaries and already-created future invoices first;
  preserve existing history and distinguish rule changes from invoice corrections.
- Full invoice settlement and payment corrections remain TX-04. Derive purchase
  payment status from `paid_at` and count the invoice payment once.
- Unpaid invoice projection is implemented (verified 2026-10-13): the monthly
  summary includes each invoice once by due date until an actual payment date
  replaces it. SQLite tests cover next-month purchases, cached total updates,
  due-date corrections, early and late payments, and profile isolation.
  The UI identifies the balance as projected. Separate settled and committed
  amounts and broader scheduled-entry projections remain SUM-02.

### Cascade deletion review

Review each relationship and choose whether to block deletion, archive records, or clear optional references. The chosen behavior must preserve financial history while allowing legitimate corrections.

### Case-insensitive category uniqueness

- [x] Prevent case-insensitive duplicate category names (verified 2026-10-09):
      the service and SQLite unique index share Unicode NFC/lowercase normalization.
      Integration tests verify accented case variants, canonical equivalence,
      direct database rejection, profile isolation, and archived-name reservation.
      Legacy databases must resolve conflicting names before applying this index;
      migration failure rolls back rather than renaming or deleting history.

## Work needed for the first version

### Dates and entry identity

- Require a reference date for every transaction.
- Standardize stored dates and document each field's meaning.
- [x] Implement closing and due-date rules, including purchases on the closing day
      (verified 2026-10-09): card services and SQLite tests cover both inclusion
      policies, adjacent-period corrections, short months, leap years, and rollover.
- Define `transactions.type`, `payments.type`, and monetary sign conventions.

### Values and relationships

- [x] Define calculated and statement-recorded invoice totals (verified 2026-10-09):
      tests verify atomic purchase reconciliation, preservation of incomplete paid
      statements, stale-preview rejection, aggregate overflow, and rollback if audit
      persistence fails.
- Ensure installment numbers stay within the declared count and amounts add up to the purchase total.
- Keep installment start and end dates consistent or derive them.
- Ensure related categories, invoices, recurrences, and installment groups belong to the same user.
- Validate compatibility between payment methods and invoice associations.

### Database evolution and integration

- [x] Add versioned schema migrations (verified 2026-09-21): Drizzle generates SQL and snapshots; startup applies pending migrations. Integration tests verify legacy adoption, subsequent schema changes, repeat runs, and failure rollback.
- Keep shared types and database consumers aligned with schema changes.
- [x] Prevent monthly cash-flow queries from counting both card purchases and
      invoice payments (verified 2026-10-08): SQLite tests count invoice payment once
      and exclude linked purchases and unlinked credit-method entries.
- Generate installments idempotently. Recurrence reads remain projection-only;
  persist confirmations idempotently under the recurrence work above.

## Discussed possibilities

### Accounts and money sources

An accounts table could track balances and identify the source of invoice payments. `payments` describes methods and does not replace a bank account. If account tracking is adopted, receipts and payments will need account relationships.

### Consumption and cash-flow views

The application may offer separate category-based consumption analysis and cash-flow reporting. Each view must state its meaning clearly, and consumption views must not treat invoice payment as a new purchase.

### Original installment-purchase event

If the timeline needs both the full purchase event and its installments, derive the original event from `installment`. Do not create another transaction for the full amount.
