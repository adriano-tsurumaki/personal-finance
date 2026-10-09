# Versioning and releases

This policy defines how to assess changes, number application releases, and record
their contents. Apply it during implementation and release preparation alongside
the [project guidelines](../AGENTS.md).

## Version format and source of truth

Use `MAJOR.MINOR.PATCH` for application versions. The `version` field in
`package.json` is the source of truth. A release tag adds the `v` prefix: package
version `1.2.3` corresponds to Git tag `v1.2.3`.

A release can include several commits. Do not increment the package version for
each implementation commit. Change it when preparing a release, and keep release
notes, tags, and distributed artifacts aligned with that version.

## Initial development: 0.x

Versions below `1.0.0` indicate initial development. Use the following project
convention during this phase:

| Change              | Version increment | Example           |
| ------------------- | ----------------- | ----------------- |
| Compatible bug fix  | Patch             | `0.1.0` → `0.1.1` |
| New functionality   | Minor             | `0.1.1` → `0.2.0` |
| Incompatible change | Minor             | `0.2.0` → `0.3.0` |

Reset patch to zero when incrementing minor. Highlight incompatible changes in
release notes even though major remains zero. This is a project convention;
Semantic Versioning does not promise a stable public API during `0.x` development.

Use `0.1.0` as the target for the first organized development release. Documenting
this policy does not itself prepare that release or change the current version.

Adopt `1.0.0` when the intended initial product scope is ready for stable use,
existing data upgrade paths have been verified, and the public compatibility
contract is defined. Reaching `1.0.0` does not require completing every deferred
feature.

## Stable releases: 1.0.0 and later

Apply Semantic Versioning to the application's public compatibility contract:

| Change                       | Version increment | Example           |
| ---------------------------- | ----------------- | ----------------- |
| Compatible bug fix           | Patch             | `1.2.0` → `1.2.1` |
| Compatible new functionality | Minor             | `1.2.1` → `1.3.0` |
| Incompatible public change   | Major             | `1.3.0` → `2.0.0` |

Reset patch when incrementing minor, and reset minor and patch when incrementing
major. Choose the highest required increment across all changes in a release.
Several features in one release require one minor increment, not one per feature.

Documentation, tests, refactoring, formatting, and build maintenance do not
automatically determine a version increment. Assess their actual effect on the
distributed application. A maintenance change that fixes runtime behavior can
justify a patch release.

## Application compatibility

For this desktop application, assess compatibility across:

- Existing user data and the supported upgrade path from earlier releases.
- Public import and export formats, when implemented.
- Documented user workflows and externally consumed interfaces, when present.

An internal refactor, renderer/main contract change shipped together, or database
migration does not automatically require a major release. Determine whether users
can upgrade with their data intact and continue using supported public behavior.
Record required user actions, removed behavior, or unsupported upgrade paths as
incompatibilities. A major version number never authorizes data loss; preserve
financial history under the [data model rules](data-model.md).

## Implementation responsibilities

Before implementing a change, inspect the current package version, this policy,
and relevant existing release notes. Determine whether the work is a compatible
fix, compatible feature, incompatible change, or maintenance without public impact.
Reassess that classification if the implementation scope changes.

During implementation:

- Preserve supported compatibility or explicitly document the intended break.
- Keep required migration code, regression coverage, contracts, and documentation
  with the change that needs them.
- If `CHANGELOG.md` exists, update its `Unreleased` section for meaningful
  application changes, including upgrade requirements and incompatibilities.
- In the completion report, identify material release impact or upgrade
  requirements. Distinguish a proposed version increment from a prepared release.
- Keep `package.json` unchanged unless release preparation is part of the task.

Creating implementation commits does not itself request a release, tag, push, or
publication. Follow the existing authorization rules in `AGENTS.md` for Git actions.

## Commit conventions

Continue using English Conventional Commit messages in the established form:

```text
type(scope): imperative summary
```

Examples:

```text
feat(categories): add category archiving
fix(transactions): preserve settlement date
refactor(summary): simplify cache invalidation
docs(releases): document versioning policy
chore(release): prepare v0.1.0
```

Use `!` and a `BREAKING CHANGE:` footer for an incompatible public change. Explain
the impact and required upgrade action rather than just announcing a break:

```text
feat(export)!: replace the legacy export format

BREAKING CHANGE: Export consumers must support the new documented format.
```

`feat` normally signals a minor increment and `fix` normally signals a patch.
An incompatibility takes precedence over the commit type, subject to the `0.x`
policy above. Other types have no automatic version effect. Keep commit grouping
coherent and follow the repository's commit guidelines.

## Changelog conventions

Create a root `CHANGELOG.md` when preparing the first release. Keep all project
documentation and release notes in English. Until then, record material release
impact in the implementation report and relevant feature documentation.

Use an `Unreleased` section for pending changes. At release preparation, move the
included entries into a version section with a release date in `YYYY-MM-DD` form.
Use headings such as `Added`, `Changed`, `Fixed`, `Removed`, and `Breaking changes`
only when they have entries. Explain user-visible outcomes, compatibility, and
upgrade actions; do not copy the entire commit history into the changelog.

The following is a fictional layout example:

```markdown
# Changelog

## Unreleased

## 0.1.0 - YYYY-MM-DD

### Added

- Add the initial supported application workflows.
```

## Release procedure

1. Review changes since the previous release tag. For the first release, review
   the intended baseline without retroactively tagging earlier commits.
2. Select the next version under this policy and update `package.json`. Update
   other tracked release metadata only where it actually stores that version.
3. Prepare the changelog entry, including incompatibilities and upgrade actions.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm test:db`.
   Run any additional checks required by the changed area. Resolve failures before
   declaring the release ready.
5. Run `pnpm make` for the intended supported platform. Verify the generated
   installer, application startup, and an upgrade from the previous release with
   representative existing data. For the first release, verify a clean install
   and any supported legacy data adoption. Record what was actually validated;
   do not imply validation of platforms that were not tested.
6. Inspect and stage the intended release changes, then create a release commit
   such as `chore(release): prepare v0.1.0` when commits are authorized. Preserve
   unrelated working-tree changes under the existing commit guidelines.
7. When tagging is requested as part of the release, create an annotated tag on
   that release commit. For example:

   ```powershell
   git tag -a v0.1.0 -m "Release v0.1.0"
   ```

8. Push the release commit and tag, or publish artifacts, only when requested.
   Verify that distributed artifacts correspond to the tagged source and carry
   the same application version.

Once a release is distributed, preserve its version, tag, and artifacts. Do not
move its tag, reuse its version for different contents, or replace its artifacts
with changed builds. Publish corrections as a new version.

## Database migrations

The application version and the Drizzle migration sequence serve different
purposes. Keep migration identifiers independent of application release numbers.
A release may include zero, one, or several migrations.

Preserve migrations already applied by released versions. Evolve the database
through subsequent migrations and verify supported upgrades, rollback on failure,
and preservation of financial history. A schema change that upgrades transparently
does not by itself imply an incompatible application release.

## Automation

The initial release process is manual. Follow this policy consistently before
adding automated version selection, changelog generation, tagging, or publication.
Any future automation must implement the `0.x` rules explicitly, preserve release
immutability, and retain the required validation and publication authorization.

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
