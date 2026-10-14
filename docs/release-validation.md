# Release validation

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
