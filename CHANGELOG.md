# Changelog

## Unreleased

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
