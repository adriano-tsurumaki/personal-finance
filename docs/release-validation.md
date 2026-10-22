# Release validation

## 0.10.1 - 2026-10-22

The approved patch centralizes select fields and their accessible IDs and allows
menus to open above their trigger when space below is insufficient. This records
release preparation, not a distribution-readiness declaration.

### Completed checks

- Three independent analysis agents reviewed the code, commit grouping, and version
  impact. Code review approved the implementation without findings.
- The complete repository suite passed all 187 tests before the metadata-only
  version bump, including three new select field tests for unique IDs, accessible
  feedback, null/zero/string values, placeholders, and disabled controls. A retry
  outside the sandbox resolved temporary session-file rename restrictions.
- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed with version `0.10.1`.
- `pnpm make` generated production bundles, the Windows x64 application package,
  and the Squirrel installer. The packaged `app.asar` and executable product/file
  versions were checked and report `0.10.1`. Distributables are under `out/make`.
- Existing dependency `use client` warnings and the ESLint configuration module-type
  warning did not prevent compilation, checks, or packaging.

### Pending checks and known limitations

- The initial sandboxed packaging attempt could not resolve `github.com`. Retrying
  outside the sandbox completed packaging and installer generation.
- The available browser could not access the local preview server. Verify menu
  direction at window edges, dialog scrolling, long lists, keyboard navigation,
  and resizing in Electron before distribution. The new tests verify markup,
  not interactive behavior or geometry.
- Installer execution, clean installation, application startup, and an installed
  upgrade from `0.10.0` with representative existing data were not verified.
- No schema migration or manual upgrade action is required from `0.10.0`. Existing
  financial records, contracts, and operation guards are preserved.
- No release tags exist to establish distributed artifact provenance. Historical
  release preparation commits and changelog entries do not demonstrate distribution.
- No other platform was packaged or validated. No tag, push, or publication was
  performed.

## 0.7.0 - 2026-10-19

The approved minor version adds an optional one-calendar-day offset to invoice
opening reference dates from the second installment onward, and fills the first
reference date when selecting the purchase date. This records release preparation,
not a distribution-readiness declaration.

### Completed checks

- Three independent analysis agents reviewed the pending code, commit grouping,
  and version impact. Code review approved the implementation with no findings.
- The complete repository suite passed all 166 tests before the metadata-only
  version bump. Coverage includes month/year rollover, leap February, preserved
  amounts and invoice membership, stale previews, retries, and older receipts.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and all 102 database/domain
  tests passed with package version `0.7.0`. Database tests used a project-local
  temporary directory to avoid sandbox session-file rename restrictions.
- `pnpm make` generated the production main, preload, and renderer bundles,
  Windows x64 application package, and Squirrel installer. The packaged `app.asar`
  declares version `0.7.0`; distributables are available under `out/make`.
- Existing dependency `use client` build warnings and the ESLint configuration
  module-type warning did not prevent verification or packaging.

### Pending checks and known limitations

- The initial sandboxed packaging attempt could not resolve `github.com`.
  Retrying with network access completed packaging and installer generation.
- Exercise purchase-date selection and clearing, manual first-reference-date
  changes, offset checkbox toggling, preview/save, keyboard navigation, and both
  locales in Electron. Existing renderer tests do not exercise these interactions.
- Installer execution, clean installation, application startup, and an installed
  upgrade from `0.6.0` with representative existing data have not been verified.
  Automated integration tests do not substitute for installed-application checks.
- No new schema migration or manual upgrade action is required from `0.6.0`.
  Existing plans, financial amounts, invoice membership, and older creation
  receipts are preserved. Known legacy adoption and recurrence coverage
  limitations documented for earlier versions remain unchanged.
- No other platform was validated. No release tag, push, or publication was
  performed.

## 0.6.0 - 2026-10-19

The approved minor version adds full invoice payment confirmation, date correction,
undo, and distinct payment events in the monthly timeline. Both timeline counters
include those events. This records release preparation, not a distribution-readiness
declaration.

### Completed checks

- Independent review approved the implementation after the timeline tab counter
  was aligned with the event list; no findings remain.
- The complete repository test suite passed all 164 tests, including settlement
  idempotency, exact invoice/profile ownership, early and late payment months,
  correction and undo, statement-total preservation, stale-data rejection,
  atomic audit rollback, monthly snapshot publication, and profile reset.
- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed with package
  version `0.6.0`. `pnpm test:db` also passed all 100 database and domain tests
  with that version.
- `pnpm make` built the production main, preload, and renderer bundles and
  generated the Windows x64 application package and Squirrel installer after a
  retry with network access. Distributables are available under `out/make`.
- The packaged `app.asar` declares version `0.6.0`.
- Existing dependency `use client` build warnings and the ESLint configuration
  module-type warning did not prevent verification or packaging.

### Pending checks and known limitations

- The initial sandboxed packaging attempt failed to resolve `github.com`;
  retrying with network access completed packaging and installer generation.
- Installer execution, clean installation, application startup, and an installed
  upgrade from `0.5.0` with representative existing data have not been verified.
  Automated integration tests do not substitute for installed-application checks.
- Exercise payment confirmation, date correction, undo, payment-only months,
  profile switching, keyboard interaction, and both locales in Electron before
  distribution. Native UI interaction was not manually verified.
- Settlement uses existing invoice storage and audit history. No schema migration
  or manual upgrade action is required. Partial and multiple payments remain
  deferred. The existing recurrence coverage limitation for early-paid invoices
  remains; see [Recurrences](recurrences.md).
- No other platform was packaged or validated. No release tag, push, or publication
  was performed.

## 0.5.0 - 2026-10-19

The approved minor version and changelog are prepared for profile settings and
indicator anchors, together with persistent timeline ordering and profile selection.
This records release preparation, not a distribution-readiness declaration.

### Completed checks

- The complete repository test suite passed all 161 tests after the financial
  precision correction. Independent review approved the correction and the three
  implementation groups with no remaining blocking findings.
- The opening balance now combines the baseline and included historical totals
  with exact `BigInt` arithmetic before signed safe-cent validation. Regression
  coverage verifies offsetting flows at both limits, monthly continuity, and
  rejection of out-of-range historical balances.
- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed with package
  version `0.5.0`.
- `pnpm test:db` passed all 98 database and domain tests with version `0.5.0`,
  including additive anchor migration, historical row preservation, restart and
  profile isolation, external-connection cache invalidation, invoice dates,
  installment preservation, and recurrence coverage boundaries.
- `pnpm make` built the production main, preload, and renderer bundles and
  generated the Windows x64 application package and Squirrel installer after a
  retry with network access. Distributables are available under `out/make`.
- The packaged `app.asar` declares version `0.5.0`. The indicator-anchor migration
  is included in packaged resources; its SHA-256 matches the source migration
  (`ad6ee2e761333aba67e133bc640633eeca78d5f090b4cd7c3547dd7c27a47cd4`).
- Existing dependency `use client` build warnings and the ESLint configuration
  module-type warning did not prevent verification or packaging.

### Pending checks and known limitations

- An initial build log inside `.vite` conflicted with Forge's cleanup of that
  directory; moving the log outside build outputs resolved it. The subsequent
  sandboxed packaging attempt failed to resolve `github.com`; retrying with
  network access completed packaging and installer generation.
- Installer execution, clean installation, application startup, and an installed
  upgrade from `0.4.0` with representative existing data have not been verified.
  Automated migration tests do not substitute for installed-application checks.
- The available browser could not reach the local preview server. Exercise the
  profile menu, settings sidebar, both locales, signed balance entry, anchor
  save/removal, partial and excluded months, profile switching, application
  restart, and explicit sign-out in Electron before distribution.
- The additive anchor migration preserves financial records. Profiles without
  settings retain full-history calculations; removing an anchor restores them.
  Startup applies the migration automatically, with no routine manual upgrade
  action. Unresolved legacy recurrence dates and relevant unknown invoice coverage
  still require explicit reconciliation; the anchor never guesses missing dates.
- The existing recurrence coverage limitation for early-paid invoices remains;
  see [Recurrences](recurrences.md).
- No other platform was packaged or validated. No release tag, push, or publication
  was performed.

## 0.4.0 - 2026-10-19

The approved minor version and changelog are prepared for installment management
and the additional category icon. This is release preparation, not a
distribution-readiness declaration.

### Completed checks

- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed with package
  version `0.4.0`.
- `pnpm test:db` passed all 86 database and domain tests, including the additive
  installment migration, preserved historical rows, atomic operations, durable
  retries across restart, invoice integrity, and historical direct-plan management.
- All renderer test files passed through `tsx --test` (55 tests), including
  localized installment markup, allocation, individual-action restrictions,
  single-entry copy cleanup, and existing store regressions.
- `pnpm make` built the production main, preload, and renderer bundles and
  generated the Windows x64 application package after a retry with network access.
  The packaged `app.asar` declares version `0.4.0`; the installment migration is
  included in packaged resources and its SHA-256 matches the source migration.
- The same `pnpm make` run completed Squirrel installer generation successfully;
  Windows x64 distributables are available under `out/make`.
- Build warnings about dependency `use client` directives did not prevent
  compilation. ESLint reported its existing configuration module-type warning.

### Pending checks and known limitations

- The initial packaging attempt failed with `getaddrinfo ENOTFOUND github.com`.
  A retry with network access completed application packaging and installer generation.
  The earlier releases' Squirrel generation failure did not recur in this run.
- Installer execution, clean installation, application startup, and an installed
  upgrade with representative existing data have not been verified for this version.
  Automated migration tests do not substitute for installed-application checks.
- Exercise installment creation, allocation and preview changes, retry, deletion,
  profile switching, keyboard interaction, and both locales in Electron before
  distribution. Renderer tests primarily verify markup and pure allocation logic;
  they do not validate the complete interactive installment lifecycle.
- Inconsistent legacy installment plans remain preserved with unsupported changes
  blocked. New installment purchases require credit and a selected card; historical
  direct-payment plans remain manageable. Startup applies the additive receipt
  migration automatically, with no routine manual upgrade action.
- The existing recurrence coverage limitation for early-paid invoices remains;
  see [Recurrences](recurrences.md).
- No other platform was packaged or validated. No release tag, push, or publication
  was performed.

## 0.2.0 - 2026-10-15

The approved minor version and changelog are prepared for recurrence management.
This is release preparation, not a distribution-readiness declaration.

### Completed checks

- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed.
- `pnpm test:db` passed all 67 database and calendar tests, including additive
  recurrence migration, rollback, profile isolation, and preserved financial history.
- The complete renderer regression suite passed all 49 tests covering stores,
  localization, recurrence presentation and mutation ownership, summary markup,
  and notification lifecycle behavior.
- New regression tests verify replacement of a BRL 100 estimate by a BRL 120
  confirmation, idempotent confirmation, single invoice cash flow after February
  or March payment, and preservation of a paid BRL 300 statement total when
  confirming its purchase details.
- Production Vite bundles and the Windows x64 application package were generated
  by `pnpm make` with application version `0.2.0`. The packaged resources include
  the recurrence migration directory.

### Pending checks and known limitations

- The initial packaging attempt could not resolve `github.com`. A retry with
  network access completed application packaging, but `pnpm make` failed during
  Squirrel installer generation: `CreateZipFromDirectory` could not start a helper
  executable and reported `The system cannot find the file specified` (exit code
  `4294967295`). The same installer-toolchain failure was recorded for `0.1.0`;
  restore the toolchain and rerun before distribution.
- Installer execution, clean installation, application startup, and an installed
  upgrade with representative existing data have not been verified for this version.
  Automated migration tests do not substitute for installed-application checks.
- Pre-confirmation coverage availability remains inconsistent when an invoice is
  paid before an occurrence's scheduled month. The estimate is correctly replaced
  after confirmation without duplicate cash flow. See
  [Recurrences](recurrences.md) for the current behavior and unresolved coverage policy.
- Incomplete legacy recurrence rules retain their history but require explicit
  ending and replacement. Paid or statement-recorded invoices can require estimate
  coverage reconciliation before dependent summaries are available.
- No other platform was packaged or validated. No release tag, push, or publication
  was performed.

## 0.1.0 - 2026-10-14

The version and changelog are prepared for the first organized development release.
Distribution readiness remains pending until the installer checks below succeed.

### Completed checks

- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` passed.
- `pnpm test:db` passed all 37 database and calendar tests, including supported
  legacy adoption, migration rollback, and preservation of financial history.
- The renderer regression suite passed all 34 tests covering stores, localization,
  summary markup, and notification lifecycle behavior.
- Production Vite bundles and the Windows x64 application package were generated
  by `pnpm make` with application version `0.1.0`.
- Formatting changes preserve all migration snapshot and TypeScript configuration
  values; the lockfile matches Prettier's output for the previous dependency data.

### Pending checks

- `pnpm make` failed during Squirrel installer generation. Its
  `CreateZipFromDirectory` step could not start a helper executable and reported
  `The system cannot find the file specified`. Restore a working installer toolchain
  and rerun the command before distributing the release.
- Verify the generated installer, a clean installation, application startup, and
  supported legacy database adoption in the installed application. Automated
  database tests do not substitute for these installed-application checks.
- No other platform was packaged or validated. No release tag, push, or publication
  was performed.
