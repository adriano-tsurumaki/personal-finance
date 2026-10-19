# Release validation

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
