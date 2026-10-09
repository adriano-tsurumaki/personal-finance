# Project guidelines

## Required language standard

Always use English when creating or updating project content. This is a mandatory
project standard for naming (files, directories, variables, functions, classes,
types, interfaces, properties, aliases, and other identifiers), code comments,
documentation, and other technical text committed to the repository.
Use clear, consistent English names and wording in all new or revised content.

## Structure and responsibilities

Before creating or reorganizing files, types, utilities, or aliases, consult
[Project structure and naming](docs/project-structure.md) and follow its conventions.

Organize UI-only code in `src/renderer`, with types close to the feature that owns
them and UI utilities in `src/renderer/lib`.
Keep contracts between processes in `src/shared/contracts` and common utilities
that are independent of any process in `src/shared/lib`. DTOs returned by main
belong in contracts, even when only one UI module consumes them.
`shared` must not import from `renderer` or `main`, including via `import type`.
Do not perform migrations outside the scope of the task.

When changing an organizational convention, update the corresponding documentation.
Keep structure documentation focused on rules, using explicitly fictional examples
instead of inventories or references to specific feature implementations.
Track concrete pending work in [Future improvements](docs/future-improvements.md).
When working on a related area, check relevant pending items against the code and
update their status only after verifying the completion criteria. Do not perform
unrelated migrations just to close pending items.
For financial data rules, consult [Data model](docs/data-model.md).

## Conditional formatting

Always use braces for control-flow bodies, including single-statement `if`
branches. Separate each `if` statement from adjacent statements with a blank
line before and after it. No extra blank line is required at block boundaries
or between an `if` branch and its `else`. ESLint enforces these rules;
`pnpm lint:fix` applies automatic corrections.

## Code reviews

When performing a code review, follow [Code review guidelines](docs/code-review.md).

## Creating commits

When the user asks to create commits, inspect the recent Git history and follow
its established message conventions instead of asking the user to repeat them.
Use English messages with the existing `type(scope): imperative summary` style;
choose the type and scope from the actual change and established repository usage,
omitting the scope when appropriate to the historical convention.
Use a body only when it helps explain a non-obvious reason or consequence.

Group commits by coherent purpose, such as styling, business logic, migrations,
features, bug fixes, or repository instructions. Do not combine unrelated work
merely because it belongs to the same task or touches the same file. Keep the
tests, contracts, and documentation needed for a change with that change, and
order dependent commits so each commit remains coherent and buildable. Do not
split changes mechanically by file extension or create artificial tiny commits.

When a file mixes concerns, stage the relevant hunks or prepare an intermediate
file version in the index so each commit contains only its intended changes.
Preserve the final working tree and all user changes; never discard code to obtain
a cleaner commit. Review each staged diff and run the checks appropriate to the
changes before committing. Avoid blanket staging without inspecting every change.

An explicit request to create commits authorizes the necessary local staging and
commits. Create them without asking again for message or grouping confirmation.
Report the resulting commit hashes and subjects. Do not push or rewrite existing
history unless the user requests it.
