# Project structure and naming

This document defines the required organization of code, types, and imports. Consult it before creating or reorganizing files. It describes project conventions, not an inventory of the repository or a migration plan.

Feature, component, type, and utility names in the examples are fictional. They illustrate placement and dependencies, do not refer to implemented features, and do not require creating the illustrated files. Directory responsibilities and alias targets are normative.

## Required language standard

Always use English for new or updated names, code comments, documentation, and other technical project text. This includes file and directory names, variables, functions, classes, types, interfaces, properties, and aliases, as required by [Project guidelines](../AGENTS.md).

## Core principle

Keep each definition close to the responsibility that owns it. The number of consumers alone does not determine where code belongs.

Keep UI code within `renderer`, separated into components, feature modules, utilities, and state. A type used by several components within one feature can stay in that module. A contract returned by main belongs in `shared/contracts`, even when only one screen consumes it.

Do not centralize unrelated types in generic files such as `shared/types.ts` or a global `renderer/types` directory. A local `types.ts` is appropriate when its context is clear.

## Directory responsibilities

| Location | Responsibility |
| --- | --- |
| `electron/` | Main and preload entry points |
| `src/main/` | Database access, IPC handlers, main process services, and domain rules |
| `src/renderer/` | UI entry points, page markup, application composition, and styles |
| `src/renderer/modules/` | UI features, their components, and presentation models |
| `src/renderer/components/` | Components reused across features and their props |
| `src/renderer/lib/` | UI utilities independent of a component, such as formatting |
| `src/renderer/store/` | Shared UI state and its actions |
| `src/shared/contracts/` | Input, output, and API contracts between processes, organized by subject |
| `src/shared/lib/` | Utilities shareable across processes, independent of React, DOM, Node, and Electron |
| `src/electron.d.ts` | Environment declarations, including the `Window` extension |

Keep feature-specific styles and assets close to the feature. Application-wide styles belong within `src/renderer`. Keep entry points thin and delegate behavior to the responsible modules or services.

`lib` does not replace the domain or collect business services. `shared` is not the automatic destination for everything reused in the UI.

## Dependency direction

Processes consume shared contracts:

```text
main ────────→ shared/contracts
preload ─────→ shared/contracts
renderer ────→ shared/contracts
```

- `shared` must not import code or types from `renderer`, `main`, or entry points in `electron`.
- Main and preload must not depend on renderer components, stores, utilities, or internal types.
- Renderer accesses main services through the API exposed by preload, without importing their implementations.
- `shared/lib` must not depend on implementations specific to a process.

These rules apply to `import type` and type re-exports. Although removed at runtime, type imports still establish an architectural dependency.

## Where types belong

| Definition | Location |
| --- | --- |
| Component props | In the component or an adjacent `types.ts` |
| Presentation model | In the UI module that owns it |
| Store state | Alongside the store; local state stays in the component or module |
| DTO sent or returned by main | `src/shared/contracts/`, organized by subject |
| Preload API interface | `src/shared/contracts/`; the `Window` declaration imports it |
| Entity or value object | In the domain responsible for its rules |
| Environment declaration | A `.d.ts` file |

Use `.ts` for ordinary exported and imported types. Related contracts can share a file; one file per interface is not required.

### Fictional DTO example

Suppose a `ReadingRoom` feature consumes a `ReadingSummaryDto` returned by main. Define that DTO in `src/shared/contracts/reading-summary.ts`. Both the service and renderer can import it:

```ts
import type { ReadingSummaryDto } from '@shared/contracts/reading-summary';
```

Do not define the contract inside the UI feature and then import it from main or shared code. If the feature needs presentation-only fields, define a local model and transform the contract in the consuming module. If it uses the response unchanged, consume the contract directly instead of duplicating it.

The `Dto` suffix can clarify a contract's role, especially when an entity represents the same concept, such as `ReadingSummary` and `ReadingSummaryDto`. Responsibility and placement define the contract; a suffix alone does not.

## Contracts, domain, and presentation

- Contracts describe serializable data exchanged through the API, with defined fields and units.
- Entities and value objects own identity, operations, validation, and business rules.
- Presentation models contain derived data and organization needed by the UI.

A field calculated by main can belong to a DTO when that is the deliberate service contract. Being calculated does not automatically make a field exclusive to renderer.

Create domain layers only when business rules justify them. In the fictional reading feature, a domain could live in `src/main/reading/domain/`. Objects with business validation and operations belong in that domain, not in a formatting utility.

Do not rely on instance methods or prototypes crossing IPC. TypeScript types do not replace runtime validation of received data.

## Utilities and units

Choose `renderer/lib` for UI responsibilities and `shared/lib` for common responsibilities across processes. Do not move a utility to shared code solely because several components use it. Financial calculations with business rules belong in the responsible domain or service.

For example, a fictional `formatReadingDuration` helper belongs in `src/renderer/lib/format/reading-duration.ts`, while a process-independent `normalizePeriodKey` helper can belong in `src/shared/lib/period-key.ts`.

Document each function's input and output units. Convert values explicitly at boundaries when units differ, such as cents versus monetary units; do not infer units from formatting or presentation.

## Naming and local organization

Use PascalCase for components, types, and component or feature directories. A component or feature directory may use `index.tsx` as its main implementation. Supporting component files use PascalCase. Files named by subject use kebab-case.

The following fictional structure illustrates these rules:

```text
src/
├── main/
│   └── reading/
│       ├── reading-service.ts
│       └── domain/
│           └── reading-session.ts
├── renderer/
│   ├── components/ProgressBadge/
│   │   ├── index.tsx
│   │   └── types.ts
│   ├── modules/ReadingRoom/
│   │   ├── index.tsx
│   │   ├── ReadingHistory.tsx
│   │   └── types.ts
│   ├── lib/format/reading-duration.ts
│   └── store/reading.ts
└── shared/
    ├── contracts/
    │   ├── reading-summary.ts
    │   └── reading-api.ts
    └── lib/period-key.ts
```

Prefer names that express responsibility, such as `ProgressBadgeProps` and `ReadingSummaryDto`. Do not use `I` or `T` prefixes solely to indicate an interface or type. Use local `types.ts` files when grouping related types improves readability; extracting types from components is optional. Do not create `index.ts` files solely to re-export everything.

## Aliases and imports

Use these targets when configuring aliases:

| Alias | Target |
| --- | --- |
| `@lib/*` | `src/renderer/lib/*` |
| `@components/*` | `src/renderer/components/*` |
| `@modules/*` | `src/renderer/modules/*` |
| `@store/*` | `src/renderer/store/*` |
| `@shared/*` | `src/shared/*` |
| `@main/*` | `src/main/*` |

This table defines mappings, not which aliases are enabled. Add aliases only for actual usage. Check the TypeScript and consuming process's Vite configuration before using an alias, and keep their resolution aligned. An alias never authorizes a dependency that violates process boundaries.

Prefer relative imports within a module and aliases to access another area. Using the fictional examples:

```ts
import type { ProgressBadgeProps } from './types';
import type { ReadingSummaryDto } from '@shared/contracts/reading-summary';
import { formatReadingDuration } from '@lib/format/reading-duration';
```

Use `import type` for dependencies used exclusively as types. Avoid a global `@types` alias and redundant aliases such as `@utils` and `@lib` for the same responsibility.

## Maintaining this guide

Update this document when an organizational rule changes. Renaming or moving an implementation does not require updating fictional examples. Keep repository inventories, migration history, completion status, and pending work out of this guide.

Apply conventions to new code and refactors related to the requested work. Do not move unrelated files solely to standardize them. Track concrete follow-up work in [Future improvements](future-improvements.md), and verify relevant items against the implementation before updating their status.

For financial data rules, consult [Data model](data-model.md).
