# Changelog

## Unreleased

### Changed

- Move recurring commitments from the monthly workspace tab to a dedicated sidebar
  screen. Add compact occurrence cards, rule action menus, name search,
  income/expense/pending filters, and month navigation alongside a responsive
  today-based 45-day forecast, shown beside the list from 1024px. Use shared
  screen headers, search fields, and filter control sizes. Split recurrence editor
  state, asynchronous previews, save commands, and form presentation into focused
  collaborators. Preserve existing recurrence calculations, confirmation, lifecycle,
  invoice coverage, and financial history. No database migration or manual upgrade
  action is required.

## 0.13.0 - 2026-10-23

### Added

- Add `pnpm db:seed:demo` to recreate an isolated development profile with 103
  categories and 16,236 transactions for category screen previews. Include active
  and archived categories, empty and busy cards, descriptions, and historical
  income/expense combinations. Existing profiles are preserved; no new migration
  or manual upgrade action is required.

### Changed

- Modernize category management with compact responsive cards, accessible action
  menus, localized name search, compatibility filters, and a collapsible archived
  section. Show current-month recorded income, expenses, entry counts, and daily
  activity charts without counting invoice payments again. Preserve existing
  themes, category rules, and history; no dependencies, database migration, or
  manual upgrade action are required.

- Move category management from the monthly tabs to a dedicated Categories
  screen in the sidebar. Enable Timeline in the sidebar to return to the monthly
  workspace, and guard navigation during pending financial operations. Existing
  categories and financial history are preserved; no database migration or manual
  upgrade action is required.

### Fixed

- Reject category activity totals or daily amounts outside exact integer-cent
  precision, showing activity as unavailable instead of displaying rounded totals.
- Keep category names and descriptions at the top of each card and group monthly
  activity at the bottom, reserving space for secondary amounts so cards in a row
  remain aligned despite different descriptions or activity.

## 0.12.0 - 2026-10-23

### Added

- Add a collapsible sidebar, initially showing icons only, with grouped Dashboard,
  Timeline, Categories, Cards, Invoices, and Installments destinations. These
  destinations remain unavailable until their screens are migrated; existing
  monthly tabs remain in place. Move the profile menu to the sidebar footer.
  No database migration or manual upgrade action is required.

## 0.11.0 - 2026-10-23

### Added

- Add the supplied Bubblegum, Japan Blues, Sakura, Zen, and Claude Plus themes,
  including their light/dark colors, loaded font families, corner shapes, shadows,
  spacing, and letter spacing. Theme styles are isolated and restore the original
  Ledger appearance when switched back. Fonts use Google Fonts with fallback
  stacks when unavailable. Existing preferences and financial data are preserved;
  no migration or manual upgrade action is required.

- Choose Ledger or Graphite appearance independently of Light, Dark, or System
  color mode in Settings > General. The app remembers the preference across
  restarts and profiles, including profile selection and window controls.
  Failed saves preserve the previous appearance and allow retry. No financial
  database migration or manual upgrade action is required.

### Fixed

- Keep startup usable while web fonts are pending or unavailable by fetching font
  definitions after local document load. Correct secondary foregrounds on month
  navigation, dialog close controls, and timeline actions in imported dark themes.

- Pair filled secondary surfaces with their foreground tokens in settings tabs
  and card views, and use the accent foreground on hovered window controls so
  imported themes keep those labels readable.

- Keep semantic colors and dark-mode component variants aligned when following
  the system appearance, with a single shared palette for both renderers.

## 0.10.1 - 2026-10-22

### Changed

- Share select field composition and option definitions across forms, with unique
  generated trigger IDs and associated labels, descriptions, and validation errors.
  Existing values and financial operation guards are preserved.

### Fixed

- Allow select menus to open above their trigger when there is insufficient space
  below. No database migration or manual upgrade action is required.

## 0.10.0 - 2026-10-21

### Changed

- Choose the current invoice, next invoice, or two invoices later when creating
  installments, with each option showing its due day and month. Deferring changes
  the first invoice and subsequent billing months independently of timeline dates.
  Existing plans are preserved; no migration or upgrade action is required.
  Inherited selections beyond the three normal choices remain explicitly visible.
  Suggestion failures allow retry or explicit invoice mapping without hiding catalogs.

### Added

- Display invoice purchases and unlinked credit entries in a minimal table with
  bottom row dividers, multiple selection by clicking rows, and a selected count.
  Selection is local to each displayed entry set and resets when that set changes;
  bulk financial actions are not included. Existing entry actions and installment
  restrictions remain available. Amounts and actions align right, the reference-date
  column is compact, and selected rows use the theme’s green highlight, including
  when clicking titles and secondary text. No database migration or upgrade action
  is required.
  Labeled checkboxes also support keyboard selection and expose each row's selected
  state. Custom column widths keep reference dates compact and descriptions flexible.

## 0.9.0 - 2026-10-20

### Added

- Separate reference-date entries and cash flow into monthly timeline tabs, with
  distinct totals and a cash-flow chart accompanied by its included movements.
  Keep expected inflows, expected outflows, and savings in the monthly summary.
  Select payments/due dates or all reference-date entries as the chart basis,
  including credit purchases even when their payment falls in another month.
  Invoice payments are excluded from reference totals to avoid counting purchases
  twice. Recurring estimates are grouped by rule and effective cash-flow date.
  Existing financial calculations and data are preserved; no upgrade action is required.

### Changed

- Use NumberFlow for smooth monthly balance and indicator animations, with
  locale-aware BRL and percentage formatting.

### Fixed

- Allow editing retained defaults for paused recurrences without resuming them.
  Earlier occurrences remain available for confirmation, ignoring, and restoration
  in their scheduled month. No migration or manual upgrade action is required.
- Keep paused-rule cards and their dimmed styling in All recurrences only.
  The selected-month tab shows retained occurrences normally and no projected
  occurrences during paused intervals, while preserving confirmed history.

## 0.8.0 - 2026-10-20

### Added

- Record PIX and boleto payments on credit with separately retained principal,
  interest, and IOF, accepting BRL amounts or total percentage rates.
- Confirm a selected recurring expense as a credit installment plan, including
  a future first invoice, without changing later recurring commitments or
  duplicating the original estimate. Show charge breakdowns in the timeline
  and installment schedule.
- Select the first invoice closing month for single credit expenses and new
  installment plans, creating missing configured billing periods on save.

### Upgrade notes

- Startup applies an additive migration for nullable financing metadata. Existing
  financial history and installment plans are preserved; no manual action is
  required. Consolidated financing-cost reporting remains outside this delivery.

## 0.7.0 - 2026-10-19

### Added

- Optionally move invoice-opening installment reference dates forward by one
  calendar day from the second installment onward, including month-end starts.
  Existing plans and invoice membership are preserved; no database migration or
  manual upgrade action is required.
- Automatically fill the first installment reference date when selecting the
  purchase date, while allowing a subsequent manual reference-date adjustment.

## 0.6.0 - 2026-10-19

### Added

- Confirm full credit-card invoice payment with the actual date, correct that date,
  or explicitly undo payment. Linked purchases reflect the invoice status without
  changing their original dates. Atomic audit history and stale-data guards protect
  confirmation; retrying a confirmation does not duplicate cash flow.
- Display invoice payments as distinct timeline events in the actual payment month,
  including existing paid invoices. Correction moves the event; undo removes it.
  Invoice details and monthly indicators refresh together without counting purchases
  again as payment expenses.

### Upgrade notes

- Uses existing invoice payment storage. Existing financial records are preserved;
  no database migration or manual upgrade action is required.

## 0.5.0 - 2026-10-19

### Added

- Profile settings dialog with a topic sidebar, general language preferences, and
  indicator settings, available from the profile menu.
- Optional profile-specific indicator start dates and signed opening balances.
  Calculations include the start date, preserve the full timeline, and exclude
  earlier cash flow without treating the opening balance as income. Older periods
  show unavailable indicators; anchor months identify partial totals.

### Upgrade notes

- An additive migration stores indicator settings without changing existing
  financial records. Startup applies it automatically; existing profiles retain
  full-history calculations until a starting point is configured. Removing the
  setting restores full-history calculations. No manual upgrade action is needed.

### Fixed

- Remember timeline date ordering across navigation and application restarts.
- Reopen the last active local profile on startup; explicit sign-out clears the
  remembered session. Existing profiles and financial records are preserved,
  without a database migration or manual upgrade action.

## 0.4.0 - 2026-10-19

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
