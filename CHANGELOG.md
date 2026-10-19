# Changelog

## Unreleased

### Added

- Pill icon option for categories.
- Monthly expense installment plans with exact cent allocation, anchored dates,
  complete schedule and invoice previews, atomic saves, and durable retry protection.
- New installment purchases require credit and a selected card. PIX, cash, and
  debit are unavailable for creation; existing direct-payment plans are preserved.
- Editable installment preview amounts with local locks and automatic redistribution
  of the remaining purchase total, plus optional invoice-opening reference dates
  after the first installment. Creation uses compact invoice information and
  localized prompts for unselected payment methods and cards.
- Installment management with selected-month and all-plan views, schedule progress,
  payment evidence, an eight-month reference-date forecast, description corrections,
  and guarded whole-plan deletion. Timeline and invoice rows identify each position.
- Card installments preserve statement totals and payment dates, preview historical
  calculated-invoice impacts, and reuse existing cash-flow rules without duplicate
  purchase outflows. Individual installment financial changes are blocked.

### Upgrade notes

- An additive migration introduces profile-scoped installment creation receipts
  without changing existing financial rows. Startup applies it automatically.
  Inconsistent legacy plans remain preserved and visible for review; unsupported
  plan changes are blocked. See [Installments](docs/installments.md).

## 0.3.0 - 2026-10-15

### Added

- Toggle the monthly timeline between oldest and newest dates first, including
  projected recurrences, with a separate control immediately above the entries.

## 0.2.0 - 2026-10-15

### Added

- Recurrence rules with versioned transaction defaults, anchored schedules,
  read-only timeline and cumulative cash-flow projections, and a local-date
  45-day forecast.
- Explicit occurrence confirmation with per-entry overrides, durable ignore/restore
  decisions, inclusive pause/end boundaries, and resumption without backfilling gaps.
  Confirmation replaces the estimate once; credit cash flow counts only the invoice,
  using its actual payment month after settlement and preserving statement totals.
- Ledger recurrence management with selected-month and all-rules views, localized
  feedback, invoice coverage reconciliation, and coordinated financial refreshes.

### Upgrade notes

- An additive migration preserves existing recurrence, version, and transaction
  identifiers. Incomplete legacy rules require explicit review and can be ended
  without deleting their recorded transactions; no old scheduled dates are guessed.
- Paid and statement-recorded invoices require explicit recurrence coverage.
  Dependent summaries remain unavailable until reconciliation, avoiding duplicate
  totals. Confirmation does not record payment or receipt.

### Known limitations

- Before confirmation, an invoice paid before a recurrence's scheduled month can
  leave that payment month's summary available while a later query reports unknown
  estimate coverage. Confirmation suppresses the estimate and counts the invoice
  once in its actual payment month. See [Recurrences](docs/recurrences.md).

## 0.1.0 - 2026-10-14

### Added

- Local profiles with persisted Portuguese and English preferences, BRL formatting,
  and financial data isolated by profile.
- Transaction creation, editing, copying, and confirmed deletion, with optional
  notes, category selection, and payment methods validated by transaction type.
- Category management with custom names, icons, colors, descriptions, archival,
  and case-insensitive name uniqueness.
- Credit cards with billing cycles, historical invoices, calculated or recorded
  statement totals, and audited corrections with before/after previews.
- A monthly timeline and projected cash-flow summary that carries earlier balances
  into the selected month and counts each paid or due invoice only once.
- Coordinated financial loading and mutations, unavailable-data presentation,
  retry feedback, and protection against obsolete responses after profile changes.
- Versioned SQLite migrations with regression coverage for legacy adoption,
  rollback, ownership, and preservation of financial history.

### Upgrade notes

- This is the first organized development release. Profiles are local and open
  without authentication; they are not password-protected accounts.
- Supported legacy database adoption preserves existing identifiers, dates,
  amounts, and associations. Only the documented previous initializer schema is
  supported; databases missing `categories.icon_key` require the previous
  application's upgrade first. See [Database development](docs/database-development.md).
- Resolve legacy category names that conflict under Unicode normalization and
  lowercase comparison, and duplicate invoice closing dates for the same card,
  before upgrading. Conflicting migrations roll back instead of renaming,
  merging, or deleting financial history.
- Legacy cards retain unknown billing settings, and legacy invoice amounts remain
  recorded statement totals. The cumulative summary starts from zero before the
  first recorded event and includes unpaid invoice projections; it does not
  represent a confirmed bank account balance.
