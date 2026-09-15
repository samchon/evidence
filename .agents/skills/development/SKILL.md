---
name: development
description: Defines Evidence Graph implementation, testing, validation, and change-integrity rules. Use before modifying source, tests, package wiring, workflows, or generated artifacts.
---

# Development

## Work Rules

Read the project skill and inspect a nearby peer before introducing a new file or abstraction. Preserve the user's scope and the package boundaries.

- Fix general behavior rather than special-casing a consumer, fixture, or expected answer. Do not monkey-patch dependencies to make a test pass.
- Treat repeated symptom fixes as evidence that the cause or design needs another investigation.
- Keep implementation and tests in TypeScript and execute TypeScript with `ttsx`. Keep `scripts` as plain CommonJS JavaScript executed with Node, without a tsconfig or lint.config in that directory.
- Declare named functions with `function`, including `export async function` for asynchronous public functions. Use asynchronous filesystem and process APIs when available; keep pure computation synchronous.
- Delegate runtime type checks to `typia` instead of hand-written shape validators. Test project logic, not `typia.assert` or other dependency validators.
- Base Evid-prefixed types on `D:/github/samchon/ttsc/packages/evidence` and its existing contracts. Follow its named base-interface and artifact-specific interface structure. Every object shape must have its own named interface in a separate file. Anonymous object type literals are forbidden without exception, including union members, intersections, property/parameter/return annotations, generic arguments, and assertions. Union aliases reference named object types; never inline an object shape to shorten a declaration.
- Run compilation through `ttsc`. Each package and the test workspace extend `config/lint.config.ts` from their own lint configuration. Keep enabled rules at error severity across implementation and tests; fix violations instead of weakening the configuration to pass a build.
- Keep executable files small and free of reusable logic. Public imports must not start the CLI, scan a project, or evaluate configuration.
- Use upstream grammars through the common adapter contract. Do not fork the parser engine or import a language compiler just to cover an unsupported syntax case without a product decision.
- Update documentation with behavior changes. Run `pnpm format` before an ordinary commit and inspect what it changed.
- Apply the [documentation skill](../documentation/source-comments.md) to declaration contracts, member JSDoc, implementation rationale, and test scenarios before considering a code change complete.
- Use constant `Singleton` and `VariadicSingleton` instances with initialization inside their callbacks. Put exported namespace members before internal declarations.

## Explicit Types

Annotate variable bindings, class fields, parameters, and return values, including local intermediates and callbacks. Use the named contract for structured values and preserve meaningful literal or union types. Do not substitute `any` or an assertion for a checked annotation. Apply this to new or changed implementation; a documentation-only edit does not authorize an unrelated annotation migration.

Annotate destructured bindings with the value's contract. A `for...of` binding cannot carry a TypeScript annotation, so explicitly type its iterable or producer. Catch values remain `unknown` until narrowed.

```ts
const inventory: IEvidenceInventory = index.snapshot();
const units: IEvidenceUnit[] = inventory.units;
const selected: string[] = units.map(
  (unit: IEvidenceUnit): string => unit.id,
);
for (const unit of units) {
  const name: string = unit.name;
}
```

## Consequence Analysis

Trace each verified change through callers, public types, serialization, package contents, generated output, Windows/POSIX behavior, and failure/recovery paths. For parser work also trace inventory completeness, host identity, aliases, review fingerprints, and watch invalidation. A missing capture can reduce the denominator and make an incorrect graph pass.

## Testing

Only meaningful logic unit tests are allowed. Hardcoded tests that duplicate type members, registry entries/counts, package allowlists, or source/document spelling are forbidden without exception. Use typia reflection when code needs literal values from a type. Do not test test harnesses or third-party validators. Verify product transformations and failure/recovery behavior with independent inputs and expected semantics.

Use English file and directory names, including disposable test paths. Unicode content and identifiers may be used to verify source behavior.

Create every temporary file and directory only under the gitignored test/.tmp directory, including ad hoc scripts and build experiments. TestFileSystem.experiment owns test trees there; interrupted runs must not leave fixtures in tracked source directories. Never put temporary work in node_modules or a root-level temporary directory.

Follow AutoMovie's unit-test structure: one exported `test_<behavior>` function per `test/src/features/<category>/test_<behavior>.ts` file. The entry point uses `@nestia/e2e`'s `DynamicExecutor` to discover the functions, and tests use `TestValidator` assertions. Keep the test workspace in `test`, not a second `tests` tree.

Call the logic directly. Give changed predicates a negative counterpart and meaningful boundary cases. Follow the [test scenario documentation rules](../documentation/source-comments.md#test-scenarios). Do not add installation experiments, tarball verification, CLI subprocess tests, or a Node test-runner framework.

Take expected inventories and semantics from the contract, not the current parser output. Avoid tests that merely assert a particular implementation spelling. Do not create speculative tests for every reversible documentation change.

Use `TestFileSystem.experiment(location, records, closure)` for disposable file trees, with `save` for scenario updates and `erase` for explicit cleanup. Write multiline fixture and generated source text with `dedent` from `@typia/utils`.

## Validation

Run only affected local logic tests from the test workspace with `pnpm start --include <filter>`. Full local test runs are forbidden; the test CI workflow owns the complete suite.

Use `pnpm build` and the affected logic unit tests according to the project skill. Build owns type and lint validation; do not add a separate typecheck command. Inspect package metadata and preparation scripts directly without creating installation experiments.

Do not silently skip failed validation, change baselines to hide a regression, or represent unavailable analysis as a successful check. Report exact commands and any platform/tooling limitation. Once the relevant checks pass, rerun them only for new changes or unresolved concerns.

## Change Integrity

Treat tests, fixtures, dependency ranges, workflows, public types, and package allowlists as part of the behavior under review. Stage only authorized changes. Preserve user edits and verify generated README/LICENSE copies are not accidentally committed.
