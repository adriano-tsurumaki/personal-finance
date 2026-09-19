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
