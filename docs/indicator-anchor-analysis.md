# Indicator anchor: implementation analysis

Status: approved and implemented on 2026-10-19. This document retains the analysis
that guided the change. See [Indicator anchors and settings](indicator-anchors.md)
for the delivered behavior and validation. Configuration lives in the profile
settings dialog, as requested after approval.

## Requested behavior

Use a full, inclusive start date per profile and a user-supplied opening balance.
The opening balance represents the amount immediately before cash-flow events
on that date. Preserve all historical entries, invoices, installment plans, and
recurrence decisions. The anchor is a reporting boundary, not a transaction,
settlement, or recurring monthly cut-off.

For example, with an October 10 anchor and BRL 500 opening balance, an October 9
expense is excluded, an October 10 expense of BRL 100 is included, and the closing
balance becomes BRL 400. The BRL 500 is not income and does not enter monthly net
or savings-rate calculations. Negative and zero opening balances must be allowed.

## Conflicts and proposed rules

| Area                  | Current behavior and implementation consequence                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash-flow date        | `monthly-statement.ts` uses explicit payment dates, reference-date fallback for direct entries, invoice due dates while unpaid, and actual invoice payment dates after settlement. Apply the anchor to those effective dates, rather than timeline dates.                                                                 |
| Cumulative balance    | Historical flow currently starts from zero and feeds each month's opening balance. Replace pre-anchor flow with the supplied balance once. A date inside a month requires a separate baseline step in the daily series; it must not appear as income.                                                                     |
| Older months          | Keep history navigable, but mark indicators before the anchor unavailable or outside the reporting range. Do not present excluded months as valid zero totals. In the anchor month, identify totals as partial and show daily points only from the anchor onward.                                                         |
| Credit cards          | A purchase before the anchor can belong to an invoice paid or due after it. Include the authoritative invoice total once on its effective date. Do not trim invoice totals by purchase date or count purchases separately. Explain that the supplied balance is before remaining invoice payments.                        |
| Paid invoices         | A later correction to `paid_at` can move an invoice across the boundary. Recalculate affected balances, preserving the existing audited correction workflow.                                                                                                                                                              |
| Installments          | Include existing installment commitments through their direct cash-flow or invoice dates. Do not filter an entire plan by its purchase date or regenerate its persisted schedule.                                                                                                                                         |
| Direct recurrences    | `recurrences.getCashFlow` aggregates earlier occurrences into opening totals. Bound its historical counting and decision subtraction at the anchor, including schedules that started earlier. Filtering only returned daily rows would leave excluded history in the opening balance.                                     |
| Credit recurrences    | `aggregateCreditRecurrence` groups schedules through billing segments and handles early or late persisted invoice payments. Add a cash-flow lower bound without discarding older scheduled purchases that contribute to later invoices. A lower bound on scheduled dates alone is incorrect.                              |
| Incomplete history    | Unknown invoice coverage and `repair_required` recurrence rules currently make dependent summaries unavailable. Excluded historical issues should cease to block indicators only when their entire financial effect is provably before the anchor. Uncertain legacy dates must remain unavailable rather than be guessed. |
| Cache                 | The statement LRU is keyed by profile/month and invalidates on database revisions. Persist anchor settings in SQLite so updates participate in revision invalidation; include the setting read and financial reads in the same snapshot.                                                                                  |
| Profile isolation     | Own settings by the active profile in main. Do not accept a renderer-supplied owner. Switching profiles must discard pending settings loads, saves, and financial refresh results from the old session.                                                                                                                   |
| Concurrent UI actions | Saving or removing the anchor changes all projected balances. Guard controls and handlers with `useFinancialOperations`, holding a mutation token through persistence and coordinated month refresh. Local date and balance editing can remain independent until submission.                                              |

## Proposed implementation scope

- Add a profile-owned settings row containing an optional start date and signed
  integer-cent opening balance, with an additive versioned migration. Existing
  profiles have no anchor and retain current behavior.
- Validate calendar dates and safe integer cents in main. Add explicit IPC
  contracts for reading, saving, and removing the setting. Removing it restores
  the full historical calculation, without rewriting transactions.
- Add a settings editor in the profile settings dialog, showing the active date and opening
  balance. Localize UI labels in both supported catalogs. State clearly that
  balances include projected commitments and that the anchor month may be partial.
- Extend summary availability metadata to distinguish an excluded period from
  a query failure or unresolved recurrence coverage. Keep the timeline and
  recurrence-review tools usable when a summary is outside the reporting range.
- Update the monthly aggregator, recurrence cash-flow aggregation, and credit
  billing segment aggregation together. Avoid a renderer-only filter.

## Required validation before delivery

Cover inclusive boundaries, dates inside a month, leap days, year transitions,
positive/negative/zero baseline balances, empty months, months before the anchor,
save/remove persistence, profile isolation, and cache invalidation. Verify direct
payment overrides, invoices purchased before but paid after the anchor, early and
late invoice settlement, statement totals, installments crossing the boundary,
confirmed/ignored recurrence decisions, credit coverage, and legacy unknown dates.
Also cover blocked concurrent actions, session switches during save, stale replies,
refresh failures, and retry behavior.

This is compatible new functionality under the project's `0.x` policy and requires
a minor increment when preparing a release. The two preference fixes delivered with
this analysis are compatible fixes. No release version is changed by this work.
