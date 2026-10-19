# Indicator anchors and settings

Open the profile menu at the top of the application and choose **Settings**.
The dialog uses a topic sidebar and a separate options area. **General** contains
the active profile's language preference. **Indicators** contains its optional
start date and opening balance. These preferences are independent per profile.

## Reporting rules

The start date is inclusive. The signed opening balance, stored in integer cents,
represents the amount immediately before cash-flow events on that date. It is
added once to the cumulative balance and does not count as income, monthly net,
or savings. Zero and negative baselines are valid. For example, BRL 500 before
October 10 and a BRL 100 expense on October 10 produces a BRL 400 balance.

Apply the boundary to effective cash-flow dates: explicit payment or receipt
dates, reference dates for unsettled direct entries, due dates for unpaid
invoices, and actual payment dates for paid invoices. An invoice for purchases
before the anchor still contributes its full authoritative total if its effective
cash-flow date is on or after the anchor. Never count those purchases separately.
Installment plans retain all persisted positions and follow these same rules.

The anchor month shows partial totals when the date is not its first day, and its
daily balance series begins on the start date. Its opening balance is the supplied
baseline. Later months carry the baseline plus included historical cash flow.
Months entirely before the boundary retain usable history and recurrence review,
but their indicators show unavailable amounts with an explanation. This is a
reporting exclusion, not a load error; it produces no retry-error notification.

Saving settings refreshes the selected month. **Use full history** removes the
anchor and restores the original calculation from zero before the first event.
Neither operation creates, deletes, rewrites, or settles financial transactions.
Balances remain projections including unpaid commitments, rather than confirmed
available bank balances.

## Recurrences and unresolved history

Direct recurrence aggregation bounds both historical counting and decision
subtraction at the anchor. Credit aggregation uses a cash-flow lower bound inside
its billing segments, retaining earlier scheduled purchases whose invoices fall
after the boundary. Confirmation and ignore decisions keep their original
identities and suppression behavior.

Unknown coverage on an invoice whose effective cash-flow date is known to be before
the anchor no longer blocks included totals. Coverage affecting included dates
still requires reconciliation. Legacy rules with unknown anchors, unknown card
rules, and ambiguous invoice mappings remain unavailable when their financial
effect cannot be proven outside the reporting range. The anchor cannot infer
missing historical dates. Existing recurrence projection limits, including early
invoice payments described in [Recurrences](recurrences.md), still apply.

## Persistence and coordination

The additive `indicator_anchors` table stores at most one row per profile. Main
derives ownership from the active session, validates calendar dates and signed
safe integer cents, and copies only accepted input properties. Profiles without
a row retain the existing full-history behavior. Startup migrations preserve all
existing users, financial rows, and identifiers; no manual upgrade is required.

Settings and financial calculations are read in the same SQLite snapshot.
Settings writes participate in database-revision invalidation of cached monthly
statements, including writes through another database connection.

Loading the editor is a local read with cancellation and session checks. Editing
draft fields and changing language are independent of financial operations.
Saving/removing an anchor guards the action handler and acquires a shared mutation
token through persistence and coordinated month refresh. The dialog remains open
while saving; stale session completions cannot publish settings, refresh another
profile, or release another operation's token. A persistence error allows retry;
a refresh failure reports that settings were already saved and keeps amounts
unavailable until a successful financial reload or recurrence reconciliation.

## Validation

Automated coverage added for inclusive boundaries, partial months, leap days,
signed baselines, empty months, year transitions, excluded periods, profile
isolation, upgrade/restart persistence, unsafe amounts, cache invalidation,
settlement overrides, authoritative invoices, installments, recurrence decisions,
credit coverage on both sides of the boundary, and unknown legacy dates.
Renderer coverage verifies locks through refresh, duplicate-action guards,
stale sessions, operation ownership, retries, persisted changes after refresh
failure, excluded-period state, and notification behavior.

The opening balance combines the baseline and included historical totals with
exact `BigInt` arithmetic before checking the signed safe-cent bounds and
converting to a number. Regression tests cover offsetting historical flows near
both safe-cent limits, unchanged balances between months, and rejection of
historical balances beyond either limit.

Executed on 2026-10-19: the full 161-test repository suite, followed by targeted
anchor and credit-aggregation tests with added external-connection cache and
enumeration comparisons. TypeScript, ESLint, repository formatting, renderer
production build, and the migration CLI against an isolated database passed.
Visual inspection was attempted but the available browser could not reach the
local preview server; desktop rendering and interaction remain manually unverified.

See the original [approved analysis](indicator-anchor-analysis.md) for the design
conflicts and intended scope. This is compatible new functionality under the
project's `0.x` release policy. No package version is changed by implementation.
