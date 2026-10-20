# PIX and boleto on credit

Expenses support `pix_credit` and `boleto_credit` alongside ordinary card
purchases. Both require a profile-owned credit card and invoice. They represent
credit commitments; recording them does not settle the card invoice or create a
second direct cash outflow. Income cannot use these methods.

## Amounts and rates

Enter the original amount and interest and IOF independently, each as a BRL amount
or a percentage. Percentages accept up to two decimal places and apply once to
the original amount. They are total operation rates, without monthly compounding,
daily accrual, or automatic tax-rate calculation. Enter the provider's final
amounts when its calculation uses another basis. Zero charges are supported.

Main validates safe integer cents, positive principal, nonnegative charges, and
an exact total. Percentage calculations use integer basis points and round each
charge half up to cents. The charged total is principal plus interest plus IOF.
The form displays that total before submission.

Transactions retain a separate `financing` JSON object containing principal,
interest, IOF, and total cents. Single transactions also retain `financing_terms`
with the original amount/percentage inputs. Installment request receipts retain
the complete original terms, while each installment transaction stores only its
allocated amounts. Payment catalog keys distinguish the two operation types.
These fields support future analysis; a consolidated financing-cost report and
reason-for-financing field are not included.

## Invoices and installments

Single entries and new plans can choose the closing month of the first invoice.
Leaving it empty preserves automatic billing selection. With configured card
billing rules, missing future invoices are generated atomically on save. Preview
rolls back generated invoices, purchases, and audit history. Explicit invoice
mapping remains available, including for legacy cards without billing settings.
Invoice closing months and due months can differ: inspect the displayed dates.

Financed plans use the existing 2–120 monthly installment workflow. The complete
charged total is distributed in cents, with manual amount adjustments and preview
validation. Principal is distributed proportionally against installment totals,
then interest against the remaining capacities; floor allocations receive remaining
cents in position order. IOF occupies the remaining cents. Every component sums to
its original total and each row's components equal its charged amount.

Calculated invoices reconcile against the charged amounts. Statement totals and
existing payment dates retain their existing authority and correction policy.
Cash flow counts invoices once. Timeline and plan schedules show the component
breakdown. Existing installment plans are not converted or rescheduled.

## Recurring occurrences

Confirm a selected expense occurrence with either method. Single confirmation
supports charges and an invoice override. Choose **Split this occurrence into
installments** to preview and save the occurrence as a finite plan, including a
future first invoice. The plan retains an explicitly selected first invoice.
Switching to a direct payment clears invoice choices before confirmation.
This does not change the recurrence's defaults or later
occurrences. A financed rule default is an estimated amount; actual charges and
installments are supplied at confirmation rather than projected automatically.

For example, an October rent of BRL 100 with BRL 2 interest and BRL 0.50 IOF can
be confirmed as two BRL 51.25 charges in the November and December invoices.
The October rent estimate is suppressed. Later rent occurrences retain their
original rule; invoice due dates determine the plan's projected cash flow.

The occurrence points to the first installment, whose recurrence-version link
preserves provenance. Its displayed confirmed amount is the full plan total.
Creation, invoice reconciliation, retry receipt, and occurrence confirmation share
one database transaction. Repeating confirmation returns the existing result.
Confirmed occurrences cannot reuse an unrelated already-created plan. Removing
an eligible unpaid plan atomically ignores its occurrence before deleting its
entries, so the estimate does not reappear. Paid-plan deletion and individual
installment mutations retain their existing guards.

## Compatibility and validation

This is a compatible feature addition. An additive migration appends nullable
metadata columns to existing transactions; prior amounts, dates, identifiers,
invoice associations, and installment plans remain intact. Startup applies the
migration and profile entry initializes the catalog methods idempotently. No
manual upgrade action or package version bump is required for this implementation.

Automated validation covers both methods, rate rounding and invalid values,
component allocation, future invoice selection, preview rollback, stale tokens,
recurrence confirmation and duplicate retries, unchanged later defaults, plan
deletion, profile isolation, and invoice cash flow. Existing migration fixtures
exercise historical rows independently of the current ORM schema. Renderer
coverage verifies localized controls, totals, validation feedback, and breakdowns.
On 2026-10-19, validation passed 106 database/domain tests, 66 renderer/state
tests, lint, type checking, formatting, and the production renderer build. The
migration command was also exercised against an isolated database. Installer
upgrades and native desktop interaction have not been manually verified.

On 2026-10-20, the full automatically discovered suite passed 174 tests after
correcting invoice selection when switching payment methods and opening the
installment form. Lint and type checking also passed. These regression checks
cover draft normalization and invoice handoff; they do not replace interactive
desktop verification.
