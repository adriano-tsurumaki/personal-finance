# Personal Finance

Personal Finance is a desktop application that helps people understand where their
money goes, keep track of financial commitments, and project future balances from
their recorded income, expenses, and recurring estimates.

## Why it exists

Financial difficulties are harder to address when everyday spending, credit-card
bills, and future commitments are scattered across different places. Looking only
at today's balance can hide the impact of payments that are still ahead.

This project was created to help people facing financial difficulties gain a
detailed view of their finances and use that information to plan ahead. The goal
is to make spending easier to understand, reveal how commitments accumulate over
time, and support more informed decisions about financial health.

## What you can do

- Record income and expenses with categories, dates, payment methods, and notes.
- View monthly entries and cash flow, with charts and projected balances.
- Manage credit cards, billing periods, invoices, and full invoice payments.
- Plan installment purchases and see their impact across future months.
- Create recurring income and expenses, review estimates, and confirm individual
  occurrences when their actual details are known.
- Set a reporting start date and opening balance for each profile.
- Use local profiles with a Portuguese or English interface. Both languages use
  Brazilian reais (BRL).

Projections combine recorded entries, unpaid invoice commitments, and recurrence
estimates. They depend on the completeness and accuracy of the information you
enter. A projected balance is not a confirmed bank balance, and confirming a
recurrence does not automatically mark it as paid or received.

## Run locally

### Prerequisites

- Git.
- Node.js 24.x. The existing development environment uses Node.js 24.20.0; a fresh
  installation of this tutorial has not yet been validated.
- pnpm 10.10.0, matching the `packageManager` field in `package.json`.
- Internet access to download dependencies and the Electron runtime.

The application uses Electron and runs as a desktop window. The instructions below
use PowerShell on Windows. Other platforms have not been validated; see
[Build and install](#build-and-install) for the current packaging status.

After installing Node.js, install the required pnpm version if it is not already
available:

```powershell
npm install --global pnpm@10.10.0
node --version
pnpm --version
```

### 1. Get the source

```powershell
git clone https://github.com/adriano-tsurumaki/personal-finance.git
cd personal-finance
```

### 2. Install dependencies and Electron

```powershell
pnpm install --frozen-lockfile
pnpm exec install-electron
```

The second command installs the desktop runtime using the installer provided by
the pinned Electron package. It exits without downloading again when the matching
runtime is already installed.

### 3. Configure the local database

For a fresh checkout, copy the example configuration:

```powershell
Copy-Item .env.example .env
```

If `.env` already exists, keep it and review its database path instead of replacing
it. The example contains:

```dotenv
DB_FILE_NAME=./personal_finance.db
```

Relative paths are resolved from the project root. The default is a local SQLite
file, so no separate database server is needed. Without an explicit setting, the
application uses the same default path. Local environment and database files are
ignored by Git.

### 4. Start the application

```powershell
pnpm dev
```

Startup creates the database when needed and applies pending migrations before
opening the application. You can also apply migrations without opening the UI:

```powershell
pnpm db:migrate
```

`pnpm start` is an alias for the same development launch as `pnpm dev`.

## First steps

1. Create a local profile with your name, email, and preferred language.
2. Open the profile menu and choose **Settings**. Under **Indicators**, optionally
   set a start date and the balance immediately before that date. Without these
   settings, projections use the full recorded history starting from zero.
3. Review the default categories and add categories that match your spending.
4. Add your income and expenses. Configure a credit card before recording credit
   purchases, and use installment plans for purchases spread across several bills.
5. Register recurring commitments, such as salary or rent, to include their
   estimates in future months.
6. Navigate between months to review entries, cash flow, and projected balances.
   Confirm recurrence occurrences and record invoice payments as appropriate.

Profiles organize data locally and open without a password. They do not provide
authentication or separate operating-system access controls.

## Build and install

Run these commands from the project root after installing dependencies and the
Electron runtime:

```powershell
# Create an application package without an installer.
pnpm package

# Create the application package and platform distributables.
pnpm make
```

Application packages are written under `out/`, and distributables under
`out/make/`. On Windows, `pnpm make` uses the Squirrel maker to generate an
installer. Open the generated `Setup.exe` to install the application locally.

Windows x64 packaging and installer generation are recorded in
[Release validation](docs/release-validation.md). Installer execution, a clean
installation, and an installed upgrade have not yet been verified. The Forge
configuration also includes macOS ZIP and Linux DEB/RPM makers, but those platforms
have not been packaged or validated. Build on the intended target platform and
check its packaging prerequisites before treating an artifact as ready to use.

Packaged applications store `personal_finance.db` in Electron's writable `userData`
directory. They do not use `.env` to choose the database location. Development and
packaged builds therefore use separate database locations; installing a build does
not automatically import your development data. See
[Database development and migrations](docs/database-development.md) before working
with an existing database.

## Development

The application uses Electron, React, TypeScript, Vite, Tailwind CSS, Zustand,
SQLite, and Drizzle ORM. Main-process services own financial rules and persistence;
the renderer accesses them through the preload API.

| Command                                   | Purpose                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev` / `pnpm start`                 | Launch the desktop application in development mode.                  |
| `pnpm lint`                               | Check ESLint rules.                                                  |
| `pnpm typecheck`                          | Check TypeScript types.                                              |
| `pnpm format:check`                       | Check formatting with Prettier.                                      |
| `pnpm test:db`                            | Run discovered database, domain, shared utility, and renderer tests. |
| `pnpm db:migrate`                         | Create the configured database and apply pending migrations.         |
| `pnpm db:studio`                          | Open Drizzle Studio for database inspection.                         |
| `pnpm db:generate --name=describe_change` | Generate a migration after a schema change.                          |

Use the application for category changes: the database uses a custom SQLite
function that external writers must register to maintain category indexes. See
the database guide for details.

## Documentation

- [Project guidelines](AGENTS.md)
- [Project structure and naming](docs/project-structure.md)
- [Financial data model](docs/data-model.md)
- [Database development and migrations](docs/database-development.md)
- [Recurrences](docs/recurrences.md)
- [Installments](docs/installments.md)
- [Credit financing](docs/credit-financing.md)
- [Indicator settings](docs/indicator-anchors.md)
- [UI operation coordination](docs/ui-operations.md)
- [Versioning and releases](docs/versioning.md)
- [Release validation](docs/release-validation.md)
- [Changelog](CHANGELOG.md)
