---
name: development
description: Defines Evidence implementation, testing, validation, and change-integrity rules. Use before modifying source, tests, package wiring, workflows, or generated artifacts.
---

# Development

## Work Rules

Read the project skill and inspect a nearby peer before introducing a new file or abstraction. Preserve the user's scope and the package boundaries.

- Fix general behavior rather than special-casing a consumer, fixture, or expected answer. Do not monkey-patch dependencies to make a test pass.
- Treat repeated symptom fixes as evidence that the cause or design needs another investigation.
- Keep authored implementation and maintenance scripts in TypeScript. Maintenance scripts executed by Node's type stripping must use erasable syntax and pass `scripts/tsconfig.json`.
- Keep executable files small and free of reusable logic. Public imports must not start the CLI, scan a project, or evaluate configuration.
- Use upstream grammars through the common adapter contract. Do not fork the parser engine or import a language compiler just to cover an unsupported syntax case without a product decision.
- Update documentation with behavior changes. Run `pnpm format` before an ordinary commit and inspect what it changed.

## Consequence Analysis

Trace each verified change through callers, public types, serialization, package contents, generated output, Windows/POSIX behavior, and failure/recovery paths. For parser work also trace inventory completeness, host identity, aliases, review fingerprints, and watch invalidation. A missing capture can reduce the denominator and make an incorrect graph pass.

## Testing

Keep one behavior-focused Node test per `*.test.ts` file under `test/src/features` or `test/src/package`. Name the file for the behavior. Shared helpers belong in `test/src/internal`; substantial future fixture layouts belong under `test` rather than a second `tests` tree.

Open a regression with a doc comment explaining what it verifies, why the behavior matters, and the short scenario. Exercise observable behavior through public exports, actual executable entry points, or packed consumers. Give changed predicates a negative counterpart and boundary cases where they add meaningful confidence.

Take expected inventories and semantics from the contract, not the current parser output. Avoid tests that merely assert a particular implementation spelling. Do not create speculative tests for every reversible documentation change.

## Validation

Run the narrowest proving check first. Broaden when shared behavior or distribution changed. Use `pnpm typecheck`, `pnpm test`, and `pnpm verify:package` according to the project skill. Verify from the real tarball for changes that workspace links might conceal.

Do not silently skip failed validation, change baselines to hide a regression, or represent unavailable analysis as a successful check. Report exact commands and any platform/tooling limitation. Once the relevant checks pass, rerun them only for new changes or unresolved concerns.

## Change Integrity

Treat tests, fixtures, dependency ranges, workflows, public types, and package allowlists as part of the behavior under review. Stage only authorized changes. Preserve user edits and verify generated README/LICENSE copies are not accidentally committed.
