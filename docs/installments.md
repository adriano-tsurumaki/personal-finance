# Installments

Installment plans are implemented for finite monthly expenses, with 2–120
installments paid through credit with a required profile-owned card. New plans
reject PIX, cash, debit, and other non-credit methods in both the creation UI and
main, including preview and save requests. Existing direct-payment plans remain
readable and manageable without conversion; an idempotent retry can return an
already committed historical plan but cannot create another direct purchase.
Creating a plan records commitments, not payment. PIX and boleto on credit also
support explicitly supplied charges and occurrence-specific plans; see
[Credit financing](credit-financing.md). Automatic monthly interest calculation,
non-monthly billing schedules, income installments, refinancing an existing invoice, partial
payments, early repayment, and importing partially paid purchases are outside
this delivery.

## Creation and monetary rules

The Installments tab and the timeline's Add installment plan action open a
separate creation dialog. Enter the purchase total, count, purchase date, first
installment reference date, description, optional note/category, and method/card.
The complete schedule and invoice changes must be previewed before saving.
Changing the draft invalidates the displayed preview. Unselected payment/card
fields display localized prompts rather than numeric identifiers.
Selecting a purchase date also sets the first installment reference date to that
date. The reference date remains independently editable afterward; selecting a
different purchase date replaces it again. Clearing the purchase date clears both
dates. This local draft interaction uses the existing change handler and preview
invalidation without acquiring an additional financial-operation token.

The final purchase total is authoritative and uses integer cents. For total `T`
and count `N`, each installment receives `floor(T / N)` cents; the first `T % N`
positions receive one extra cent. BRL 100.00 in three installments is therefore
33.34, 33.33, and 33.33. Reject unsafe integers, nonpositive totals, fractional
counts, and a total below the count, which would generate zero-cent installments.

The creation preview allows editing any installment amount. The edited position
and locked positions retain their amounts while the remainder is split exactly
among the other unlocked positions, assigning remainder cents to the first of
those positions. Locks prevent automatic changes and still permit manual editing;
they are local draft controls, not payment evidence or persisted financial locks.
Every amount must remain positive and all amounts must sum to the purchase total.
If no free positions can absorb the remainder, saving is blocked until the amount
is corrected or another position is unlocked and adjusted. Changed allocations
are previewed again before save; the server validates the final allocation and
rejects stale or tampered previews.

Each date is calculated independently from the original first-date anchor,
clamping to the target month's final day. January 31 becomes February 28 and
March 31 in 2027; February 2028 uses day 29. The first reference date cannot precede
the purchase date. Group start/end dates match the generated reference dates.

Explicit save creates one `installment` group and every numbered transaction in
one database transaction. No transaction stores the full purchase amount in
addition to its installments. Standalone plans have no recurrence identity or parallel projection.
Occurrence-specific plans retain a link from their first installment to the
confirmed occurrence, suppressing its estimate atomically. Listing plans/months does not write; preview rolls back temporary rows,
including generated invoices and audit records.

## Invoices and financial reporting

The first card invoice is suggested from the purchase date. Users can choose an
explicit first invoice and, when required, map every position to an existing
invoice. Later installments use successive closing months of the same card.
Legacy cards without billing settings require explicit existing invoice mappings;
missing or ambiguous periods must be registered or corrected in Cards first.
Archived cards require the explicit historical-purchase option.

Each installment retains its timeline reference date independently from invoice
membership. The preview shows invoice opening/closing dates, due dates, and
reference dates outside the selected period. A first invoice override does not
change the timeline anchor or divide a full invoice balance into installments.

For card plans, an optional control places the second and later installments on
their invoices' actual opening dates. The first reference date stays unchanged.
For a purchase referenced on August 8 with month-end closing, later references
become September 1 and October 1. With a different closing rule, use the actual
period start rather than guessing the first day of the calendar month; two
successive installments can therefore appear in the same timeline month.
Unknown opening dates or starts not after the previous installment are rejected.
Group end dates follow the resolved final reference date. Existing plans keep
their recorded dates even after an invoice-period correction.

When invoice-opening dates are enabled, an additional optional checkbox advances
the second and later reference dates by one calendar day. For a card that excludes
its month-end closing day from the closing invoice, August 31 becomes September 1
and September 30 becomes October 1. The first reference date and invoice membership
stay unchanged. The offset defaults to disabled, is included in preview validation
and durable retry receipts, and requires no schema migration or upgrade action.
Disabling invoice-opening dates clears the offset in the creation draft.

The creation dialog shows a compact schedule and any affected historical payment
months. It does not render before/after invoice panels. State-derived correction
tokens, audit records, statement-total preservation, and atomic reconciliation
remain enforced by main.

Calculated invoice totals are reconciled with their linked purchases. Statement
invoice totals remain authoritative: item totals and differences change, but
adding/removing installment details does not change the recorded statement amount.
Existing invoice payment dates are preserved. Adding details to a paid calculated
invoice explicitly previews the affected historical payment month.

The existing monthly statement counts direct commitments on their reference date
when no payment date exists, and card installments through their invoice's due or
actual payment month. Purchases are not a second outflow alongside their invoice.
Cumulative balances and projected recurrences use the same existing reporting
paths. Persisted installments must never receive a second estimate layer.

## Integrity and retries

Main derives ownership from the active profile and validates every input at
runtime, including category, method, card, and invoice associations. A single
state-derived preview token covers the normalized input, generated schedule, and
all affected invoice states and memberships. Save rejects stale tokens atomically.
The same transaction persists transactions, invoices, totals, audit records, and
the creation receipt.

An additive migration creates `installment_requests`, with a unique
`(user_id, request_id)`, normalized input, and optional plan link. Repeated saves of
the same input return the existing plan, including after application restart.
Changed input under the same identity is rejected. Deletion retains the receipt
with a null plan link, so a delayed retry cannot recreate a removed purchase.
Existing financial rows and identifiers are preserved by the migration.

Creation receipts also retain explicit installment amounts and the resolved
reference dates for integrity checks and retries. Earlier receipts remain valid
with the original equal-allocation and anchored-date defaults. These dialog
enhancements require no additional schema migration or user upgrade action.

Legacy groups are checked for complete numbering, matching totals and anchored
dates, ownership, expense type, compatible associations, and consistent details.
Inconsistent groups remain visible for review; their changes and dependent
installment overview totals are unavailable. No financial history is silently
rewritten, and a group's foreign-profile transaction details are not exposed.

## Management and presentation

Management supports the selected month and all plans, per-plan schedules, monthly
amounts, plans with unrecorded payments, and an eight-month reference-date forecast.
The forecast is a purchase schedule, not invoice cash flow. Overview amounts are
unavailable during failures, loading, inconsistent legacy data, or unsafe sums.
Installment amounts are prominent; purchase totals are secondary.

Timeline and invoice rows identify the installment position and count. The
segmented meter shows schedule progress through the selected month, independently
from payment evidence. Direct settlement comes from `payment_date`; card evidence
comes from the linked invoice's `paid_at`. An elapsed schedule never implies a
paid purchase. Payment/receipt registration remains a separate deferred workflow.

Plan-level corrections change only description and note, consistently across all
entries; card corrections are audited. Amount, count, dates, method, category,
card, and invoice membership remain immutable through installment management.
Generic transaction edit/delete and invoice reassignment reject individual
installment changes in main as well as in controls. Invoice boundary corrections
that would move an installment are rejected; invoice corrections that preserve
its membership continue to use existing audited correction behavior.

Whole-plan deletion requires an aggregate preview and explicit confirmation. It
is rejected for inconsistent groups, any direct installment with recorded payment,
or any paid associated invoice. Calculated totals are reconciled; statement totals
are preserved. Copying a timeline installment keeps the existing single-entry copy
meaning and clears installment identity, payment, and prior correction authority.

Financial reads, previews, mutations, and refreshes own tokens in
`useFinancialOperations`. Action handlers enforce guards as well as controls;
mutation ownership extends through refresh. Independent local draft changes and
view selection stay available when they do not conflict. Request/session guards
reject obsolete responses, and profile changes recreate plan state and drafts.

## Validation and release impact

Validation on 2026-10-19 includes integration tests for exact cents, month-end and
leap-year anchors, the 120-position limit, atomic rollback, state-token conflicts,
idempotency, archived/legacy invoice mappings, statement and paid invoices,
individual mutation guards, deletion, and coexistence with recurrence projections.
A dedicated upgrade/restart test verifies preserved historical rows and durable
creation receipts. Renderer tests verify schedule/payment distinctions in both
locales, individual action restrictions, and single-entry copy metadata cleanup.
Additional coverage verifies localized unselected prompts, editable preview
controls without before/after panels, redistribution with locked positions,
custom allocation persistence/restarts, invoice-opening reference dates, invalid
remainders, and replay compatibility with older creation receipts.

Executed checks passed: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`,
`pnpm test:db` (84 tests), all renderer test files through `tsx --test` (55 tests),
and the Vite renderer production build. The build reports dependency directive
and bundle-size warnings; these do not prevent compilation.

The credit-only creation follow-up passed `pnpm lint`, `pnpm typecheck`,
`pnpm format:check`, all 86 database/domain tests, and all 55 renderer tests.
Regression coverage rejects PIX/cash/debit through preview and save, requires a
card for credit, and preserves management of historical direct-payment plans.

The optional invoice-opening day offset follow-up on 2026-10-19 passed
`pnpm lint`, `pnpm typecheck`, `pnpm format:check`, all 102 database/domain
tests, and the four installment renderer tests. Coverage verifies month/year
rollover, leap February, unchanged invoice membership and amounts, stale previews,
durable retries, older receipts, and malformed offset rejection. The full database
suite used a project-local temporary directory after the sandbox denied session
file renames in its default temporary directory. Interactive Electron validation
of the additional checkbox was not performed. This compatible feature requires
a minor release increment under the `0.x` policy; the package version remained
unchanged during implementation. Release preparation for `0.7.0` is recorded in
[Release validation](release-validation.md).

The browser available in the execution environment could not access the local
verification server. Interactive desktop checks, narrow-layout visual inspection,
and packaged installer validation are not claimed. Before release, exercise
creation, preview, retry, deletion, profile switching, keyboard interaction, and
both locales in the actual Electron application.

This is a compatible feature with an additive database migration and warrants a
minor increment under the project's `0.x` policy. Release preparation and remaining
distribution checks for `0.4.0` are recorded in [Release validation](release-validation.md).
Startup applies the migration automatically. Inconsistent legacy
plans require review before supported plan mutations; existing standalone entries
retain their supported behavior.
