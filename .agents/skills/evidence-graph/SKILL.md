---
name: evidence-graph
description: Defines the evidence graph domain model for @samchon/evidence-graph — the tag grammar, node kinds, hierarchy, reference resolution, obligation coverage, and exclusions. Use before changing rule semantics, the tag grammar, the configuration surface, or a diagnostic message; do not use for the mechanics of the Go rule API, which the lint-rule-authoring skill owns.
---

# Evidence Graph

## Product Contract

An artifact that cites nothing has no proof it was needed. An artifact that cites a target no configured source declares has proof of nothing. `evidence-graph/index` turns both states into compile errors under the graph the consumer defines in `lint.config.ts`.

The graph is configurable. Claims select the files and declaration hosts that owe acknowledgements; references select the evidence populations they owe. Every claim-reference pair is an independently complete obligation, and every element of a reference array remains separate.

Read `.wiki/references/autobe-mcp.md` before generalizing behavior from that prior art, and `.wiki/design/decisions.md` for settled repository decisions and their costs.

## Tag Grammar

```text
@evidence <target> <reason>
@evidenceExclude <target> <reason>
```

The first whitespace-delimited token is the target; everything after it is prose. A declaration may carry any number of tags. Every tag requires a target and non-empty reason and is validated independently.

```ts
/** @evidence docs/spec.md#pricing Sale price derives from this section. */
/** @evidence IShoppingSale The complete sale contract is mirrored here. */
```

The reason exists for review, not machine judgment. Do not add a rule that guesses whether prose is sincere; it will teach authors to write filler that passes.

## Units And Hierarchy

Two artifact kinds materialize evidence units.

- **Markdown** — a file addressed as `<path>` or an H1-H4 ATX section addressed as `<path>#<anchor>`.
- **TypeScript** — an exported type, function, or property addressed by its qualified public name.

Units form structural containment scopes. A Markdown file contains its heading outline; a heading contains lower-level headings until the next heading of equal or higher level. A TypeScript interface or object-shaped type alias contains its direct properties, and a namespace contains every nested public unit. Top-level TypeScript functions and properties have no aggregate file node.

An `@evidence` or `@evidenceExclude` target acknowledges the selected target and every selected descendant. The reference's `symbol` selector defines the obligation denominator, not the only addressable targets: every structural ancestor of a selected unit remains resolvable as an aggregate scope.

Keep selected obligations and resolvable scopes separate. Do not make every unselected unit resolvable; only actual ancestors belong to the scope closure, or an unrelated same-name declaration can create false ambiguity.

Hierarchy is identity, not spelling. Store explicit parent unit IDs while materializing. Never infer TypeScript ancestry from a dotted-string prefix: literal names may contain dots, and `A.B` can mean one literal segment or two qualified segments.

## TypeScript Classification

Selectors classify public contracts semantically.

- `"type"` selects exported interfaces, type aliases, and namespaces. Classes and enums are not type units.
- `"function"` selects exported function declarations, function-valued exported `const` declarations, public class callables, and namespace variants of those forms.
- `"property"` selects direct properties of exported interfaces and object-shaped type aliases plus exported `const`, `let`, or `var` declarations at module or namespace scope. A `const` initialized with an arrow or function expression remains a function; every other variable, including a function-typed declaration or function-valued `let` or `var`, remains a property.

Only public identities materialize. A top-level declaration needs an export modifier or local export-list alias; a namespace member needs to be exported from that namespace. Re-exports whose declarations live in another file do not create a second unit.

A mixed variable statement can carry both function and property host kinds because TypeScript attaches one leading JSDoc block to the statement wrapper. Preserve the host set; choosing one kind makes the other selector spuriously out of scope.

## Evaluation

`evidence-graph/index` evaluates the complete configured graph once per Program and answers three distinct questions.

- **Resolution.** Does every declaration target resolve to exactly one selected unit or structural ancestor?
- **Host eligibility.** Does the declaration live on a symbol kind selected by its claim?
- **Coverage.** Does every selected reference unit have one acknowledgement in this claim?

Keep claim and reference state separate. A declaration that satisfies one claim or reference never leaks coverage into another, even when the physical target is the same.

An acknowledgement scope may discharge many descendant units, but scopes within one claim-reference obligation must be disjoint. Report one duplicate diagnostic when a later scope overlaps an earlier one. This preserves the contradiction when `@evidence` and `@evidenceExclude` overlap without flooding one finding per descendant.

## Exclusions

`@evidenceExclude` records that one claim intentionally does not use a target scope. It has the same hierarchy and coverage cardinality as `@evidence`; only its reviewed intent differs.

Three properties are load-bearing.

- **The reason is mandatory.** A blank exclusion is not a decision anyone can review.
- **It belongs to one claim.** Another claim referencing the same source still owes its own acknowledgement.
- **It follows hierarchy.** Excluding a parent excludes every selected descendant, and an overlapping evidence scope is a duplicate rather than a silent override.

Never auto-exclude, auto-retarget, or delete an artifact or citation to make a graph green. Repair is the author's, and every diagnostic must name the path that performs it.

## Diagnostic Messages

Most users meet this plugin only through an error message. State what is wrong, then what fixes it. Name the claim, reference, target, source location, and supported repair. Prefer one precise diagnostic to several descendant duplicates.

## Identity Rules

- **Targets are exact tokens.** Prose is free, but target identity never depends on heading text beyond its generated or explicit anchor.
- **Paths are case-sensitive identity on every host.** Case-insensitive comparison may improve a diagnostic but never decides equality.
- **Markdown separators normalize only for Markdown targets.** Do not rewrite TypeScript literal symbol names.
- **Qualified TypeScript segments stay encoded internally.** This prevents a literal dot from collapsing into namespace or property qualification.
