---
name: development
description: Defines @samchon/lint-plugin-evidence implementation rules, testing standards, validation, consequence analysis, and change integrity. Use before writing or modifying source, tests, workflows, package wiring, fixtures, or algorithms.
---

# Development

## Contents

- [Forbidden](#forbidden)
- [Work Rules](#work-rules)
- [Consequence Analysis](#consequence-analysis)
- [Testing](#testing)
- [Validation](#validation)
- [Change Integrity](#change-integrity)

## Forbidden

These four are never acceptable; choosing any one means the approach is already wrong.

- **No monkey-patching or hardcoding.** Don't special-case a consumer, a fixture name, or an expected value to make output match. Fix the general logic. This plugin exists because `autobe-mcp` hardcoded its graph; reproducing that inside the generalization defeats the product.
- **No test-passing-only logic.** Code exists to be correct, not to turn a check green. A branch whose only purpose is to satisfy one assertion is a bug in disguise.
- **No forcing a broken design.** When the same failure keeps returning under patch after patch, the design is wrong. Stop, find the root cause, and fix the design instead of looping forever on symptoms.
- **No whack-a-mole.** Don't patch the one case that surfaced and move on. Think expansively about every case the same root cause can produce, and seal them all with coverage so the class of failure cannot recur.

## Work Rules

- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style; don't create parallel structures.
- Respect the language boundary. Rule logic is Go; the TypeScript side is a descriptor, config types, and tests. See the project skill.
- A diagnostic message is a user interface, not a log line. The evidence-graph skill states what a message owes its reader.
- Record research and decisions in `.wiki/` as you make them, and correct a wiki claim in the same change that disproves it. See the wiki skill.
- Run `pnpm format` before every ordinary commit and stage the result; never commit unformatted output.

## Consequence Analysis

Treat a reported example as one witness of a cause, not the complete problem statement. Before changing code, trace the same cause through:

- every caller and downstream consumer;
- normal, error, and recovery state transitions;
- concurrency, caching, and generated output;
- Windows and POSIX behavior, especially path case sensitivity and separators;
- boundary inputs.

Fix the verified class of failure, not only the reported witness. Cover positive, negative, and boundary cases without expanding the user's product goal.

## Testing

**Name every test after what it asserts**, at both layers.

- **Go unit tests** live beside the source in `native/`, as `*_test.go` files whose `Test*` functions each pin one assertion — `native/tag_splits_target_from_reason_test.go` is the pattern, and a file may hold more than one `Test*` when they share a subject. They exercise the rule internals directly, the pure helpers such as `parseEvidenceComment` and `classifyTarget`, because `@ttsc/lint`'s rule-driving harness is package-private upstream. When a case must drive a full rule's `Check` rather than a helper, it supplies its own reporter, and that fake must implement `rule.Reporter` **and** `rule.FixReporter` together, since Go interface satisfaction is all-or-nothing; compile-check it with `var _ rule.FixReporter = &myFake{}`.
- **TypeScript e2e tests** live in `tests/test-evidence/src/features/`, one per file. Export exactly one `test_<snake_case>` function from a matching filename. Materialize a temporary project, spawn the real binary, assert observable diagnostics, and clean up in a `finally`.

Open every case with a doc comment in the same three-part shape: a one-line `Verifies …` headline, a short paragraph stating the non-obvious _why_ (which branch or regression is being pinned), and a 2–4-step numbered list summarizing the scenario.

```ts
/**
 * Verifies evidence integrity: a citation to a section no document declares
 * fails the build, while its well-formed twin stays quiet.
 *
 * Every link in the chain fails silently rather than loudly. A namespace typo
 * drops the rule with only a stderr warning, and a project rule that never
 * publishes its index leaves every file rule quiet — and a quiet rule is
 * indistinguishable from a passing one. So the fixture pins a valid citation
 * one property away: `#pricing` exists and `#discounts` does not, in the same
 * file, under the same rule.
 *
 * 1. Index a document declaring only `Pricing`.
 * 2. Cite `#pricing` correctly from one declaration and `#discounts` from another.
 * 3. Assert a non-zero exit that names only the dangling target.
 */
export const test_evidence_reference_reports_dangling_document_section =
  (): void => {
    /* ... */
  };
```

### Coverage, not happy paths

A test that feeds a rule a well-formed evidence graph and asserts silence proves nothing fired; it does not prove the rule can fire. Each rule needs more than its happy path.

- **The transformation direction.** Assert that a violating input produces the expected diagnostic, not only that a clean input stays quiet.
- **A negative twin for every positive.** Wherever a rule fires, pin an adjacent case one property away where it must NOT fire. An over-match stays invisible until the counter-example exists — and an evidence rule that over-matches teaches users to disable it.
- **Boundaries.** The empty index, the single section, the absent index versus the present-but-empty one, the target that resolves as the wrong node kind, the reference whose prefix matches a longer id.
- **Oracle-derived expectations.** Take the expected behavior from the settled design in `.wiki/design/decisions.md` and the prior art's rationale, never from whatever the current code happens to emit. A snapshot written against the code's own output locks its bugs in.

Silence is a rule's most common failure mode here: an activation gate that never opens, a namespace typo that drops registration with only a stderr warning, and a `json:` tag mismatch that silently yields defaults all look exactly like a passing test. **Prove a rule fires before trusting that it is quiet.**

## Validation

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end through the real binary.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

Packaging is behavior. A change to the descriptor, the `files` list, or the Go source layout is unproven until a consumer-shaped test resolves the package and builds its rules.

## Change Integrity

Treat tests, fixtures, CI workflows, package wiring, dependencies, and core algorithms as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.
