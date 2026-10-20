# Recurrences: implementation analysis and product specification

**Status:** Implemented on 2026-10-14. This document records the product behavior,
adopted defaults, financial policies, and verification boundaries.

## Current foundation

The additive recurrence migration extends `recurrences` and `recurrences_versions`
without replacing historical IDs or `transactions.recurrence_version_id` links.
Complete transaction defaults, immutable occurrence decisions, explicit invoice
coverage, lifecycle services, and Ledger screens are implemented. The monthly
statement combines persisted cash flow and recurrence estimates, including opening
balances and the daily series, without creating transactions or invoices on reads.

Month navigation reads transactions, recurrence occurrences, and the statement in
one SQLite snapshot. Transport failures keep the confirmed month. Unresolved
recurrence coverage publishes the selected month and its occurrences with an
unavailable summary, so reconciliation remains accessible. `useFinancialOperations`
coordinates conflicting operations and protects profile-session boundaries.

## Confirmed product decisions

- Consulting any month computes temporary occurrences without inserting transactions or invoices. Projections must work when navigating directly to a distant month, without first visiting intervening months.
- Each occurrence is projected independently of whether earlier occurrences were confirmed or paid. Reaching its date does not confirm it automatically.
- Projections affect monthly income, expenses, net, savings rate, cumulative opening and closing balances, and the daily balance series under the appropriate payment rules.
- The recurrence screen has two internal tabs: **In month**, following the monthly summary selection, and **All recurrences**, listing all created rules, including paused and ended rules.
- The timeline and recurrence screen identify unconfirmed occurrences. A period-specific notice directs the user to **In month** to confirm them.
- Confirmation creates a definitive transaction and replaces the corresponding projection exactly once. It does not record payment or receipt.
- The rule supplies default title, estimated amount, category, payment method, and card when the method is credit. Confirmation preselects these values and permits occurrence-specific changes without changing the rule.
- Rule editing supports title, estimated amount, category, and payment method/card. Changing estimated amounts keeps the same recurrence identity. Automatic currency conversion is outside this scope; the user enters the BRL estimate and actual amount.
- Rule changes apply from an explicitly chosen occurrence to subsequent unconfirmed occurrences. Previously confirmed transactions remain intact. Changing one confirmation's amount does not automatically update the rule estimate.
- Frequency and calendar changes are outside the rule editor in this scope. Pause/resume and ending remain distinct actions; an estimated amount change never requires ending or recreating the rule.
- Pausing or ending requires choosing the last occurrence to retain, inclusively. Retained occurrences may be confirmed transactions or unconfirmed projections. Subsequent projections stop; confirmed transactions are never silently deleted.
- **In month** shows scheduled occurrences with normal styling regardless of the rule's current status. Manage paused rules from **All recurrences**.
- A confirmed occurrence remains associated with its originally scheduled month if its transaction moves to another month. The recurrence screen shows the actual transaction date; the transaction appears in the timeline by its reference date.

## Adopted implementation defaults

The implementation adopts the following defaults to close the remaining product decisions. They are implementation choices within the requested feature scope.

- A newly created rule starts with an unconfirmed first occurrence. Creating rules from existing transactions is outside this implementation; never match by title, amount, and date alone. A future source-transaction workflow must link explicitly.
- Permit confirming future occurrences as commitments, without marking them settled.
- Allow ignoring a single occurrence and restoring it later. Persist this decision so read-time projection cannot recreate an ignored occurrence.
- Unconfirmed occurrences remain projected after their dates pass. They stop contributing only through confirmation, an exception, or an effective rule boundary.
- Resume by choosing the first resumed date on the original calendar. Keep the paused gap empty; do not automatically backfill it. Preserve the original calendar anchor.
- Monthly day 31 and yearly February 29 clamp to the last valid day, calculated from the original anchor each time. A short month must not permanently shift subsequent occurrences.
- Expose the Ledger frequencies weekly, monthly, quarterly, and yearly initially; quarterly maps to monthly with interval 3. The schema's daily capability need not become an additional UI requirement.
- Anchor the **Next 45 days** panel to today's local calendar date, independently of the selected month, and label that distinction. It shares the occurrence engine but does not use the prototype's fixed date or limits.
- Show paused and ended rules in **All recurrences**. Apply the dimmed paused-rule styling only in that tab; do not add paused-rule cards to **In month**.

## Rule, occurrence, transaction, and settlement

A rule is the continuous commitment. A version stores the defaults and effective interval that applied to occurrences. An occurrence is a scheduled slot in that commitment. A transaction is created only after explicit confirmation. Settlement remains a separate direct-entry or invoice workflow.

The occurrence's immutable scheduled identity must survive title, amount, method, category, and transaction-date changes. Looking only for transactions in the selected month is insufficient: an occurrence moved elsewhere must still suppress its original projection.

Use distinct contracts for persisted transactions and recurrence projections; do not invent transaction IDs for projections or send them to ordinary transaction edit/delete handlers. Financial dates use validated `YYYY-MM-DD` calendar strings. Store and calculate amounts in safe integer cents; preserve the current statement's explicit conversion to BRL units at the DTO boundary.

## Persistence and migration

Retain existing recurrence and version identities. Extend versions with the transaction type and defaults needed for confirmation, category, payment method, optional card, a preserved calendar anchor, and explicit effective boundaries. Separate the calendar anchor from the version's effective start so a price update cannot reset the schedule.

The occurrence key is `(recurrence_id, scheduled_date)` because this scope keeps the calendar fixed across default changes. The selected rule version is provenance, not the continuous occurrence identity. Enforce uniqueness in SQLite, not only through a renderer submission lock.

Persist occurrence decisions sparsely, for confirmation and exceptions, rather than storing every future projection. A decision links the resulting transaction and applied version or records an ignored occurrence. Restoring removes the ignored decision. Deleting a confirmed transaction changes its decision to ignored atomically, so the estimate never reappears accidentally. Preserve the immutable key when a transaction is edited. Establish checks preventing both an ignored and a confirmed state for the same slot. The recurrence_occurrences table enforces unique slots and unique non-null transaction links.

Confirm atomically: validate active-profile ownership and current occurrence eligibility, reject or return an existing confirmation idempotently, create the transaction through existing validation, reconcile any invoice and audit changes, and record the occurrence decision in the same transaction. A stale default preview must be revalidated before saving.

Do not infer old occurrence identity from a transaction's mutable reference date without evidence. Migration must preserve old recurrence/version links and report ambiguous legacy cases for explicit repair. Do not rewrite already-applied migrations, discard financial history, or silently activate incomplete legacy rules.

Legacy rules migrate to `repair_required` with an unknown calendar anchor and no
inferred decisions. Their estimates are unavailable until the user explicitly
ends the incomplete rule. This action excludes its unknown estimates while
preserving every historical version and transaction link. A complete replacement
can then be created with an explicit first date. It never claims the old slots.
Archived defaults require a compatible default edit or occurrence override;
already confirmed and ignored slots do not become unavailable because their old
category or card was archived. Unknown or ambiguous invoice periods require an
explicit invoice correction or a compatible noncredit confirmation.

## Calendar and lifecycle boundaries

Generate slots from the original anchor, frequency, and interval, using half-open query and effective-version ranges. Versions of the same rule must not overlap. A default edit creates a new version while retaining the rule and occurrence identities.

For a rule anchored at 2026-03-12, monthly slots include 2026-04-12 and 2026-05-12 even if March is unconfirmed. Queries before those dates already include the projections; no background job or date-triggered insertion is necessary.

If the last retained slot is 2026-05-12, March, April, and May remain; June onward stops. Pausing permits later resumption; ending retains history and ends the rule. If June already has a confirmed transaction, show that it is preserved and can be reviewed separately. Choosing the boundary never authorizes bulk deletion.

Paused rules retain the edit action in **All recurrences**. Default edits start at a
retained scheduled occurrence and preserve the pause boundary. In that occurrence's
scheduled month, confirmation, ignoring, and restoration remain available without
resuming the rule. These actions do not generate occurrences inside the paused gap.

If a May slot is confirmed with a June reference date, **In month** for May shows its confirmed state and June date. May has no remaining ghost. June's timeline contains the transaction. Cash flow follows its actual direct-entry or invoice rules.

## Monthly and cumulative projection

Combine persisted cash-flow events with eligible, unconfirmed projections using one recurrence engine. For each query, suppress all confirmed or ignored slots by immutable identity, including transactions whose reference or settlement date moved outside the query month.

- `openingBalance` includes effective cash-flow events before the selected month, including unconfirmed recurrence projections.
- `income`, `expense`, and `net` include only effective events within the selected month.
- `closingBalance` is opening plus monthly net. Each daily balance includes opening plus events through that day.
- `savingsRate` remains monthly net divided by monthly income, or zero without income. Opening balances do not enter the rate.
- Timeline counts refer to visible entries; do not restore the removed statement identifier or cash-flow count. The unconfirmed notice counts scheduled slots for that period, not invoice outflows.

For a direct monthly income of R$3,000 starting in March with otherwise empty history, March closes at R$3,000, April opens at R$3,000 and closes at R$6,000, and May closes at R$9,000. Every slot can remain unconfirmed and no transaction row is needed. The initial history assumption remains zero; this is projected cash flow, not confirmed cash in an account.

A confirmation replaces estimated values with actual values. The monthly summary can consequently move or change, especially when the method changes from credit to PIX. Historical edits, exclusions, and boundaries must also invalidate later opening balances, not just the visible month.

Do not use the Ledger's monthly-equivalent KPI as actual monthly cash flow. A yearly R$1,200 rule can show approximately R$100/month in the rule overview but contributes R$1,200 only in its effective occurrence month. Weekly schedules can have four or five slots within a month. Include interval and status semantics when computing overview equivalents.

### Estimate replacement and definitive cash flow

An unconfirmed occurrence is an estimate, not an additional definitive transaction
or a record of payment. Confirmation atomically links one transaction to its
immutable scheduled slot and suppresses that slot's estimate across all reporting
months. Repeating the confirmation returns the same transaction instead of adding
another entry. The confirmed amount replaces the estimated amount; the two amounts
must never be added together.

For example, a March credit occurrence estimated at BRL 100 can be confirmed at
BRL 120. A calculated invoice then contributes BRL 120 once, rather than BRL 220.
Until settlement, its due date determines cash-flow placement. If that invoice is
paid in February or March, its payment date replaces the due date: the outflow
appears once in the payment month and no longer appears in the due month. Later
opening balances carry that single outflow. The purchase remains in the timeline
by its reference date and is excluded from direct cash-flow aggregation.

When confirmation adds purchase details to an already paid statement invoice,
the existing purchase preview and audit workflow applies. Its authoritative
statement total is preserved rather than increased by the purchase amount. A
BRL 300 paid statement containing a confirmed BRL 120 purchase still contributes
BRL 300 once. Confirmation leaves the purchase's `payment_date` unset; invoice
settlement remains separate.

Coverage reconciliation below concerns uncertainty while a slot remains an
estimate. It is separate from replacement after confirmation. A confirmed slot
no longer requires estimate coverage because the persisted transaction and its
invoice determine its definitive contribution.

Known limitation: credit estimate selection currently stops at the queried
month's scheduled-date boundary. If a later scheduled occurrence belongs to an
invoice paid in an earlier month, unknown coverage can leave that earlier month's
summary available while a later query reports it unavailable. This is a
pre-confirmation availability inconsistency, not evidence that confirmation counts
the estimate and transaction twice. Coverage availability still needs a
consistent policy across the payment and scheduled months, including unknown,
included, and excluded coverage.

## Credit-card projection and coverage policy

Credit is part of the specified default/confirmation model, not silently excluded from scope. A credit default requires a profile-owned card. The scheduled reference date drives timeline placement; the projected invoice due date drives cash-flow placement. A card occurrence may affect a month after its scheduled month, so the statement's projection horizon must account for billing dates, including purchases in earlier periods.

Preview cycles without calling invoice resolution paths that insert invoices or audit rows. Use persisted invoice dates and closing policy when the occurrence maps unambiguously to an existing period; use a read-only period calculation for missing periods. Resolve ambiguous or unknown legacy cycles explicitly instead of inventing dates.

For an unpaid calculated invoice, compose its persisted purchase total and unconfirmed projected purchases in memory and count their combined outflow once. Confirmation removes the projected component as the real purchase updates the calculated invoice. Missing future invoices can be represented in memory. Never write projected additions into stored invoice totals.

A statement-recorded invoice total may already include an unconfirmed recurring purchase, and a paid invoice is historical settlement. Coverage is therefore an explicit sparse decision for the immutable occurrence and concrete invoice. No decision means unknown coverage: the occurrence remains visible with an issue and the financial statement is unavailable, including later cumulative balances that depend on it. Never publish the known subtotal as a complete result.

- **Included:** the authoritative total already covers the estimate. Add zero extra cash flow; the occurrence remains unconfirmed.
- **Excluded, unpaid statement invoice:** add the estimate as a separate projected component in memory, once, without changing the stored total.
- **Excluded, paid invoice:** the financial statement remains unavailable until an explicit invoice correction reconciles the authoritative total and coverage. The existing correction preview, authorization token, and audit workflow remain mandatory.
- A coverage decision applies only to its selected invoice. A default/card/period change that maps the occurrence elsewhere requires fresh coverage. Paid status never confirms an occurrence.

Archived default categories/cards, unknown cycles, ambiguous invoice periods, and incomplete legacy rules are repair-required states. Keep historical associations intact, expose the issue, and require valid explicit defaults or invoice corrections before confirmation or complete financial totals. Legacy rules are migrated with status repair_required and a null anchor. Their old transaction/version links remain intact; mutable transaction dates never become inferred occurrence identities. No automatic legacy activation or date reassignment is permitted.

Confirmation can also record PIX or boleto on credit, with interest and IOF,
or split only the selected expense occurrence into a finite plan. See
[Credit financing](credit-financing.md) for charge calculations, future invoices,
provenance, and deletion rules. Later recurrence defaults remain unchanged.

Confirmation preselects the default card and suggested invoice; permit method/card/invoice changes using current ownership, compatibility, and correction validation. A PIX override follows direct-entry dates. An explicit invoice selection takes precedence over the suggestion. Actual `payment_date` remains unset unless a separate settlement workflow supplies it; invoice settlement is not copied into individual purchases.

## Ledger screen composition

Use the local Ledger reference: `ui_kits/ledger/RecurringManager.jsx`, `components/finance/RecurringRow.jsx`, `components/finance/TimelineEntryRow.jsx`, and `ui_kits/ledger/finance-data.js`. Consult [Design system](design-system.md) for production adaptations.

Preserve the centered 48rem composition, existing primary/income/expense palette, Instrument Sans text, JetBrains Mono amounts, border-based surfaces, compact badges, inline rule form, income/expense groups, 55% paused-row treatment, and sticky 45-day panel at the reference breakpoint. The new internal tabs are a deliberate extension using existing tab components, not a new navigation layout.

- **In month:** scheduled date, estimate or confirmed amount, rule origin, state, and actual transaction reference date when different. Unconfirmed rows offer confirmation and proposed ignore actions. Retained occurrences use normal styling even when the rule is paused. Paused intervals generate no occurrences; existing confirmed transactions remain visible. Do not render a separate paused-rule group.
- **All recurrences:** continuous rules, active/paused/ended state, defaults, cadence, first date, and last retained date where applicable. Provide create, edit, pause, resume, and end actions.
- **Timeline:** unconfirmed projected rows use the existing row language with a clear state badge and recurrence icon. The period notice links to the same month's **In month** tab. Confirmations occur in the recurrence screen.
- **Confirmation:** prefilled title, actual BRL amount, category, method, reference date, and card/invoice when applicable. Show the resulting cash-flow period before saving when the method or invoice changes.
- **Overview tiles:** retain the Ledger monthly-equivalent view, explicitly labeled as an estimate. The selected month's summary continues to show dated cash-flow totals, not equivalents.

Provide loading, unavailable, retry, and empty states for both internal tabs, and distinguish no rules from no occurrences in a month. Preserve keyboard navigation, focus restoration, light/dark tokens, reduced-motion support, and aligned `pt-BR`/`en-US` catalogs. BRL amounts are not converted to USD.

## Coordination, consistency, and performance

Follow [UI operation coordination](ui-operations.md). Rule mutations, confirmation, exceptions, pause, resume, and end hold a mutation token through persistence and necessary refreshes; handlers and controls both enforce guards. Evaluate rule reads that can publish period-dependent financial state. Independent form typing and expansion do not acquire new financial locks.

Reuse `refreshMonth()` for the mutation owner's internal financial refresh; do not invoke guarded navigation as a substitute. Refresh recurrence data and the forecast too. Preserve session generations after each asynchronous boundary, release only owned tokens in `finally`, and clear feature state on profile changes. A saved confirmation followed by a failed refresh must remain saved; retry refresh rather than creating another transaction.

The combined financial-month IPC read uses a single SQLite transaction for
transactions, scheduled occurrences, and statement aggregation. The same engine
also supplies rule queries and the today-based forecast. The existing unavailable
data and period notification behavior is retained.

Fast-forward into requested calendar ranges. Calculate cumulative projection efficiently through bounded aggregation of versions and sparse decisions, without returning historical occurrences through IPC or chaining a query per month. Test the strategy against a reference enumerator, especially exceptions moved across dates. Preserve the current revision-based bounded statement cache and invalidate affected cumulative results after historical rule/decision changes. The today-based forecast also needs a date-aware cache boundary.

Main owns persistence, validation, projection composition, and financial rules. Shared contracts own serializable IPC DTOs. Renderer feature modules own screens and presentation; shared calendar helpers must remain process-independent. No unrelated structural migration is required.

## Verification and release impact

Required coverage includes read-only distant-month navigation, March-12 monthly expansion, cumulative totals, confirmation overrides, repeated confirmation, moved reference/settlement dates, variable subscription amounts, version boundaries, month-end/leap handling, ignore/restore, inclusive pause/end, resume without gap backfill, preserved future confirmations, card billing and invoice reconciliation, archived associations, active-profile isolation, stale responses, overlapping operation ownership, refresh failure recovery, and cache invalidation.

Card/recurrence queries must leave transaction counts, invoice rows/totals, and audit history unchanged until explicit persistence. Confirmation must roll back all related writes on failure. Verify existing direct-entry and invoice workflows still work.

This feature is a compatible addition under [Versioning and releases](versioning.md).
Its additive migration supports the existing 0.1.0 and documented legacy upgrade
paths. Incomplete old rules require explicit review; financial history is preserved.
The recurrence feature was introduced in version 0.2.0 and is recorded in that release section of `CHANGELOG.md`.
No release, commit, tag, push, or publication is implied.

Automated evidence covers anchored range/count equivalence, leap and short-month
boundaries, sparse historical aggregation, no-write queries, authoritative invoice
coverage, cumulative cash flow, confirmation rollback and idempotency, moved and
deleted entries, lifecycle preservation, profile isolation, coordinated refresh,
stale responses, localized rendering, and inline form validation. Tests live beside
the calendar, main database services, recurrence presentation, and UI operation
executor. The credit aggregator is compared with a reference enumerator and a
multi-million-slot horizon with bounded billing callbacks.

Isolated browser verification uses actual main services and a separate ignored QA
database. It covers English and Portuguese, light and dark themes, narrow and
desktop layouts, the sticky forecast, keyboard tab navigation, initial/restored
focus, editable dates and amounts, and a confirmed occurrence moved to another
month. Reduced-motion overrides were checked in the reused controls' CSS; the OS
preference was not changed. Native-window inspection timed out. Installer packaging
and a distributed-app upgrade were not exercised; database upgrades use isolated
SQLite fixtures.

The implementation and verification evidence above describe the delivered recurrence scope. The early-paid invoice coverage availability issue remains a known limitation, as described in the credit estimate selection discussion. The defaults and reconciliation policy above are finalized implementation choices.
