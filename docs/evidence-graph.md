# Evidence Graph contract

Contract version 1 defines how `@samchon/evidence` turns selected artifacts into independent coverage obligations. The serialized `check`, `list`, `inspect`, `graph`, and `languages` reports use `schemaVersion: 1`; a future incompatible report or fingerprint contract requires a new version.

## Terms

| Term | Meaning |
| --- | --- |
| Artifact | One supported source family: a programming language, Markdown, Prisma, or Swagger/OpenAPI. |
| Semantic unit | One declaration that may enter a coverage denominator, such as a public type, function, property, Markdown section, Prisma model, or Swagger operation. |
| Host position | A documentation position attached to one or more claim units where Evidence tags may be written. |
| Public address | A target spelling that resolves to a semantic unit. One unit may have several aliases without creating more obligations. |
| Structural ancestor | An owner above selected descendants. It may remain addressable so one truthful aggregate citation covers its selected subtree. |
| Claim | A selected population whose hosts must cite another population. |
| Reference | One selected population that forms an independent coverage denominator for its owning claim. |
| Selected obligation | One claim/reference pair whose selected reference units must be covered independently. |
| Acknowledgement | `@evidence` on an eligible claim host, with a target and reason. |
| Exclusion | `@evidenceExclude` on an eligible claim host, stating why the target does not apply. |
| Review | `@evidenceReview` or `@evidenceExcludeReview`, paired with an acknowledgement and optionally required to carry the current target fingerprint. |
| Complete analysis | Every selected source was discovered and interpreted without an unresolved construct that could change the denominator. |

A semantic unit may have several declaration sites and public addresses. A TypeScript function exported from its source file and a barrel still creates one function obligation. Overloads, partial declarations, and reopenings merge only where an adapter's certified contract says they describe one identity. Each site may supply a host, but aliases never multiply the denominator.

## Pipeline

1. `EvidenceConfigLoader` asks the consumer's `ttsx` to typecheck and evaluate `evidence.config.ts`, then validates the default export as `IEvidenceConfig`.
2. Configuration planning resolves severity and symbol defaults and removes disabled claims, `off` claims, `off` references, and claims with no active references before artifact I/O.
3. Source discovery resolves roots from the configuration file, evaluates ordered globs, records logical and physical identities, and retains unreadable or cyclic paths as failures.
4. Each adapter materializes semantic units, declaration sites, public addresses, hosts, acknowledgements, reviews, withdrawals, dependencies, and completeness diagnostics.
5. Target applicability sends each tag only to references whose artifact grammar accepts it. `EvidenceTargetResolver` then resolves the exact target inside that reference's selected scope without global-name guessing.
6. `EvidenceGraph` evaluates every claim/reference pair independently, applies hierarchy, exclusions, cardinality, checklist, and review policies, and suppresses derivative coverage findings when an inventory is incomplete.
7. The checker returns a stable report. Query commands derive address discovery, target inspection, and graph exports from the same materialized analysis.

The checker never treats a parser failure as an empty successful population. It also never treats a syntactically resolved citation as proof that its reason is true.

## Independent obligations

Every reference array element is a separate obligation, even when two entries select the same files. Every claim is also independent, even when another claim already covers the same reference unit.

```ts
import type { IEvidenceConfig } from "@samchon/evidence";

export default {
  claims: [
    {
      name: "implementation",
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
    {
      name: "tests",
      type: "typescript",
      files: ["test/**/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
  ],
} satisfies IEvidenceConfig;
```

If an implementation function cites `docs/requirements.md#pricing`, only the first claim is covered. The selected test functions still owe their own citation to that requirement. A claim label improves diagnostics and does not merge either obligation.

References can instead form a chain. An implementation may cite a requirement, and a test may cite `../src/calculator.ts#calculatePrice`. The first edge records why the implementation exists; the second records which public implementation the test exercises. The graph checks the presence and resolution of both statements but does not run the test.

## Coverage and exclusions

Ordinary coverage requires every selected reference unit to receive at least one acknowledgement from an eligible selected claim host. A citation to a structural ancestor covers selected descendants. Positive evidence and exclusions are distinct edge kinds:

- `@evidence` says the host supplies the target for the stated reason.
- `@evidenceExclude` says the target does not apply for the stated reason.
- `noEvidenceExclude: true` refuses exclusions for that reference and leaves their targets missing.
- `uniqueEvidence: true` permits at most one distinct positive claim host per reference unit.
- `singleEvidencePerSymbol: true` requires every selected claim host to cite exactly one selected reference unit.

`evidenceExcludeCarriers` narrows which selected claim files may carry exclusions. It never expands the claim population. A misplaced exclusion is reported and supplies no coverage.

## Skill checklists

A Markdown reference with `checklist: true` changes coverage from one answer per requirement to one answer per selected claim host and requirement pair.

```ts
import type { IEvidenceClaim } from "@samchon/evidence";

const checklistClaim = {
  name: "every function follows every engineering rule",
  type: "typescript",
  files: ["src/**/*.ts"],
  symbol: "function",
  reference: {
    type: "markdown",
    files: [".agents/skills/principles/SKILL.md"],
    symbol: "h2",
    checklist: true,
    requireReview: true,
  },
} satisfies IEvidenceClaim;
```

Each selected function must answer every selected H2. A positive checklist citation answers only the named item. `uniqueEvidence` and `singleEvidencePerSymbol` are incompatible with a checklist. Exclusion-carrier globs are allowed beside a checklist only when `noEvidenceExclude: true` makes those carriers irrelevant.

## Reviews and fingerprints

`requireReview: true` requires each accepted acknowledgement to have a matching review of the same kind, target, and semantic host. Reviews do not provide coverage. A seven-character lowercase hexadecimal fingerprint identifies the cited unit and its structural subtree:

```ts
/**
 * @evidence docs/requirements.md#pricing Implements the pricing rule.
 * @evidenceReview docs/requirements.md#pricing #4c0e8e1 Checked rounding and failure boundaries against the requirement.
 */
export function calculatePrice(): number {
  return 0;
}
```

Changing evidence prose does not renew a review. Changing the cited semantic content expires it, and the diagnostic supplies the current fingerprint. Use `evidence inspect <target>` to inspect the current unit, incoming acknowledgements, and review state before recording a new review.

## Complete, empty, and failed states

| State | Graph result |
| --- | --- |
| A complete claim has no selected units | The claim is inactive. This is a healthy empty claim, not fabricated coverage. |
| A complete active claim has a complete reference with no selected units | The active obligation reports `graph-empty-reference`; error severity makes the command exit 1. |
| A selected unit has no valid acknowledgement | The obligation reports missing coverage; error severity makes the command exit 1. |
| A target is malformed, missing, outside its selected population, hidden, ambiguous, or unsupported by its host | The resolver preserves the exact public outcome; it does not choose a nearby unit. |
| An artifact type has no certified adapter | Configuration fails before source loading and the command exits 2. |
| A source is unreadable or only partially parsed, or export analysis cannot establish the selected surface | Affected claims or references remain incomplete, derivative gaps are suppressed, and the command exits 2. |
| A claim or reference has effective severity `off`, or a claim is disabled | It is removed before artifact loading and creates no obligation or watch dependency. |

Warnings preserve their findings but do not make a complete check exit nonzero. Configuration and adapter diagnostics remain errors when analysis cannot establish a trustworthy denominator.

## Declared-source guarantee

Tree-sitter identifies syntax. Each Evidence adapter adds the language-specific visibility, ownership, documentation, alias, and completeness policy needed to define a public declared-source population. A grammar being available does not certify an Evidence adapter.

The standalone checker does not invoke source-language compilers, package managers, preprocessors, macro expanders, build systems, linkers, applications, or generated-code pipelines. Bounded reexports and aliases are implemented where the selected files contain enough information. A detectable construct that can change the selected public surface and cannot be resolved must leave the inventory incomplete.

This guarantee deliberately excludes compiler-synthesized and runtime-generated members, dependency-derived inheritance, unresolved conditional compilation, dynamic export mutation, and package-entry semantics unless a language adapter explicitly certifies them. See the [certified language matrix](languages.md) and [adapter inventories](development/adapter-inventories.md) for exact boundaries.

Language expansion is incremental. A programming language appears in `evidence languages` only after its adapter passes exact inventory, host, address, graph, failure, mutation, parser-asset, and distribution gates. TSX is a TypeScript grammar variant, and a grammar-only candidate is not supported Evidence analysis.

## Truth boundary

Evidence checks structural accountability. It proves that configured obligations were selected, each accepted acknowledgement resolves to an exact target, required review records match current content, and incomplete analysis remains visible. It does not execute a test, validate business behavior, or decide whether a reason or review description is honest.

A missing acknowledgement can indicate missing work. Repair it by implementing, testing, or documenting the obligation first, then place the citation on the declaration that actually supplies it. Writing a tag solely to clear a diagnostic defeats the review contract while leaving the underlying work undone.
