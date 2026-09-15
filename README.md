# @wrtnlabs/evidence

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/wrtnlabs/evidence/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/@wrtnlabs/evidence.svg)](https://www.npmjs.com/package/@wrtnlabs/evidence) [![npm downloads](https://img.shields.io/npm/dm/@wrtnlabs/evidence.svg)](https://www.npmjs.com/package/@wrtnlabs/evidence) [![build](https://github.com/wrtnlabs/evidence/actions/workflows/build.yml/badge.svg)](https://github.com/wrtnlabs/evidence/actions/workflows/build.yml) [![test](https://github.com/wrtnlabs/evidence/actions/workflows/test.yml/badge.svg)](https://github.com/wrtnlabs/evidence/actions/workflows/test.yml)

![Evidence Graph: make every SKILL instruction 100% enforced](https://ttsc.dev/evidence/og-evidence-skill-instructions.png)

Every rule, requirement, schema, and API becomes an obligation the check enforces.

- **100% coverage** of every requirement.
- **100% compliance** with every principle.

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer stacking limit this section defines, in the buyer's words.
 * @evidence ../hooks/useCouponStacking.ts#useCouponStacking Renders the limit this hook resolves.
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Renders limits from props instead of branching on known issuer names.
 * @evidenceExclude .agents/skills/principles/SKILL.md#fix-root-causes No failure path exists in a pure renderer.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` is the agent's claim about what the code implements and why; `@evidenceExclude` records why an obligation does not apply. A target is a Markdown section, a public declaration in 19 programming languages, a model in 7 database schema languages, or a Swagger operation, all read through Tree-sitter with no compiler or build.

Delete the `useCouponStacking` line and the check stops:

```bash
$ npx evidence
Evidence check complete.
Config: /workspace/app/evidence.config.ts
Claims: 1/1 active.
Obligations: 3/3 active, 0 incomplete.
Coverage: 3/4 units covered, 1 missing.
Diagnostics: 1 errors, 0 warnings.

ERROR [graph-missing-acknowledgement] claim[0] 'components' (typescript) -> reference[1] (typescript)
Location: /workspace/app/src/hooks/useCouponStacking.ts:1:1
Subject: configured population
Claim 1 ('components') reference 2: Missing acknowledgement for '/workspace/app/src/hooks/useCouponStacking.ts#useCouponStacking'.
Repair: Cite the claim artifact that implements this unit with @evidence, or exclude it on an eligible carrier when it does not apply.
```

The error list is the task list.

## Setup

```bash
npm install -D typescript ttsc @wrtnlabs/evidence
npx evidence init
npx evidence
```

`typescript` and `ttsc` are peer dependencies; `ttsc` supplies `ttsx`, which evaluates `evidence.config.ts`. Grammars download on first use; nothing else is installed. [Step 1](#step-1-enforce-your-principles) fills the config in.

## Why a graph

### Instructions alone do not get followed

The first thing you do when you hand work to a coding agent is write the rules down. `AGENTS.md`, `CLAUDE.md`, `.agents/skills/*/SKILL.md`; the file name does not matter.

```markdown
# Engineering principles

## No hard coding {#no-hard-coding}
## Never weaken a test {#never-weaken-the-test}
## Fix causes, not symptoms {#fix-root-causes}
## Do not build it before you need it {#yagni}
## No monkey patching {#open-closed}
## Stay in the scope you were given {#stay-in-scope}
```

The agent reads all of it and says it understands. Four hours later, this is in the commit:

```ts
if (file === "wide-chars.ts") return WIDE_CHARS_EXPECTED;
```

One test would not go green, so the agent hardcoded the answer. That breaks the first rule on the list, and the build passes anyway. The type checker looks at types, the tests look for green, the linter looks for unused variables. The rules live in a document, and the build does not read documents.

Writing the rules harder does not help. [One study](https://arxiv.org/abs/2605.01771) read the tool logs instead of the model's own report: six frontier models followed a written instruction in 0 of 60 runs, and reported compliance in more than 90% of them. Every rule you add pushes one you already wrote further back.

This is not malice. If there is a cheaper way to pass the check, that is the way it goes: agents [saturate the visible test suite and fail the hidden one](https://arxiv.org/abs/2605.21384), [retrieve answers instead of deriving them](https://cursor.com/blog/reward-hacking-coding-benchmarks), and [hardcode return values per test input](https://debugml.github.io/cheating-agents).

### So the checker asks

Every function answers every rule in your skill file, in its own documentation comment, one sentence per rule. The check fails without those sentences, so the agent writes them, and you read what it says about the code.

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Looks the handler up in the registry it was handed and branches on no known name.
 * @evidence .agents/skills/principles/SKILL.md#fix-root-causes Rejects an unknown name at the lookup instead of retrying a failed call later.
 * @evidence .agents/skills/principles/SKILL.md#yagni One lookup and one throw, with no cache or index built ahead of time.
 */
export function resolveHandler(name: string, registry: Map<string, Handler>): Handler;
```

Delete any one of those lines and the check stops. Add a rule to the document and every function owes one more answer.

### There are sentences it cannot write

Suppose the agent special-cased a fixture name. That function must answer `#no-hard-coding`, and the honest answer reads:

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Branches on the fixture name "sample.ts" so the snapshot test passes.
 */
```

Two options: write that sentence as it stands, or fix the code so it never has to be written. In practice it fixes the code.

The checker cannot tell whether a sentence is true. That is the reviewer's job, and it is now a list of claims beside the declarations they describe instead of a 4,000-line diff.

### It outlives the prompt

A prompt instruction is gone in the next session and absent from CI. The checklist lives in the repository, and the same command runs in CI.

## Step 1: Enforce your principles

The rule file is already there, already Markdown, already headed. Start with it.

### Point the checker at the rule file

Replace the starter `evidence.config.ts` with one claim:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  claims: [
    {
      name: "every function answers every engineering principle",
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: [".agents/skills/principles/SKILL.md"],
        symbol: "h2",
        checklist: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
```

A **claim** selects what must cite: every function under `src`. Its **reference** selects what must be cited: every H2 in the skill file. `checklist` makes every function answer every heading.

### Run

```bash
$ npx evidence
Evidence check complete.
Config: /workspace/app/evidence.config.ts
Claims: 1/1 active.
Obligations: 1/1 active, 0 incomplete.
Coverage: 0/3 units covered, 3 missing.
Diagnostics: 1 errors, 0 warnings.

ERROR [graph-checklist-missing] claim[0] 'every function answers every engineering principle' (typescript) -> reference[0] (markdown)
Location: /workspace/app/src/resolve.ts:3:1
Subject: configured population
Claim 1 ('every function answers every engineering principle') reference 1: Host '/workspace/app/src/resolve.ts#resolveHandler' has not acknowledged 3 of 3 checklist item(s): '/workspace/app/.agents/skills/principles/SKILL.md#["fix-root-causes"]', '/workspace/app/.agents/skills/principles/SKILL.md#["no-hard-coding"]', '/workspace/app/.agents/skills/principles/SKILL.md#yagni'.
Repair: Cite every missing checklist item from this host, or exclude the scope that does not apply.
```

On an existing repository this is hundreds of errors: the real distance between your rule file and your code. Paying it down is not your job.

### Hand it to the agent

Add this to `AGENTS.md` or `CLAUDE.md`:

```markdown
## Evidence

Run `npx evidence` before finishing any task. Every error names an obligation and its repair.
Do the work first: implement, test, or document what the obligation asks for.
Then write the `@evidence` line on the declaration that supplies it, stating why in one sentence.
Never write a tag to silence an error. Never weaken `evidence.config.ts` to pass.
Use `npx evidence list` to find an address and `npx evidence inspect '<target>'` to see why one does not resolve.
```

The agent works through the list, fixing code wherever an honest answer cannot be written, and leaves this behind:

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Looks the handler up in the registry it was handed and branches on no known name.
 * @evidence .agents/skills/principles/SKILL.md#fix-root-causes Rejects an unknown name at the lookup instead of retrying a failed call later.
 * @evidence .agents/skills/principles/SKILL.md#yagni One lookup and one throw, with no cache or index built ahead of time.
 */
export function resolveHandler(name: string, registry: Map<string, Handler>): Handler;
```

```bash
$ npx evidence
Evidence check complete.
Config: /workspace/app/evidence.config.ts
Claims: 1/1 active.
Obligations: 1/1 active, 0 incomplete.
Coverage: 3/3 units covered, 0 missing.
Diagnostics: 0 errors, 0 warnings.
```

You read three sentences per function instead of the diff. `requireReview: true` on the reference also demands an `@evidenceReview` per answer that expires when the rule's text changes; see [Reviews](#reviews).

### Add CI

```yaml
- run: npm ci
- run: npx evidence
```

Exit 1 is a violation; exit 2 is incomplete analysis. Do not mask either.

## Step 2: Ground code in requirements

The checker reads no meaning, only who cited what, so anything with an address can be cited. Requirements are the next layer.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg">
  <img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg">
</picture>

Each arrow is one claim. Requirements cite idea notes, so a dropped idea is caught before code exists. Tests cite requirements and implementation, so an untested feature never passes. Whichever layer a human reviews last is the source of truth; the agent writes everything below it.

### Requirements, implementation, tests

Two claims draw the bottom of the picture:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

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
        type: "typescript",
        files: ["src/**/*.ts"],
        symbol: "function",
        noEvidenceExclude: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
```

Every requirement must be cited by a function under `src`; every function under `src` must be cited by a test, with no exclusions. Three files:

```md
# Pricing requirements

## Exact addition {#exact-addition}

Add prices without intermediate rounding.
```

```ts
export function add(left: number, right: number): number {
  return left + right;
}
```

```ts
import { add } from "../src/calculator";

export function test_add(): void {
  if (add(1, 2) !== 3) throw new Error("Unexpected sum.");
}
```

```bash
$ npx evidence
Evidence check complete.
Config: /workspace/app/evidence.config.ts
Claims: 2/2 active.
Obligations: 2/2 active, 0 incomplete.
Coverage: 0/2 units covered, 2 missing.
Diagnostics: 2 errors, 0 warnings.

ERROR [graph-missing-acknowledgement] claim[0] 'implementation' (typescript) -> reference[0] (markdown)
Location: /workspace/app/docs/requirements.md:3:1
Subject: configured population
Claim 1 ('implementation') reference 1: Missing acknowledgement for '/workspace/app/docs/requirements.md#["exact-addition"]'.
Repair: Cite the claim artifact that implements this unit with @evidence, or exclude it on an eligible carrier when it does not apply.

ERROR [graph-missing-acknowledgement] claim[1] 'tests' (typescript) -> reference[0] (typescript)
Location: /workspace/app/src/calculator.ts:1:1
Subject: configured population
Claim 2 ('tests') reference 1: Missing acknowledgement for '/workspace/app/src/calculator.ts#add'.
Repair: Cite the claim artifact that implements this unit with positive @evidence.
```

Markdown targets resolve from the reference root, which defaults to the config directory; programming targets resolve from the citing file:

```ts
/** @evidence docs/requirements.md#exact-addition Implements exact addition without intermediate rounding. */
export function add(left: number, right: number): number {
  return left + right;
}
```

```ts
import { add } from "../src/calculator";

/** @evidence ../src/calculator.ts#add Verifies exact addition through the public function. */
export function test_add(): void {
  if (add(1, 2) !== 3) throw new Error("Unexpected sum.");
}
```

```bash
$ npx evidence
Evidence check complete.
Config: /workspace/app/evidence.config.ts
Claims: 2/2 active.
Obligations: 2/2 active, 0 incomplete.
Coverage: 2/2 units covered, 0 missing.
Diagnostics: 0 errors, 0 warnings.
```

Evidence checked two structural edges. It did not run `test_add` and did not prove either sentence true.

### Documents above documents

Markdown cites Markdown in HTML comments, so the rendered document stays clean:

```md
## Coupon stacking {#coupon-stacking}

<!-- @evidence ideas/2026-03-checkout.md#stacking-limit Turns the note's per-issuer idea into a testable limit. -->

A buyer may apply at most one coupon per issuer to one order.
```

A `type: "markdown"` claim on the requirements with a reference on the idea notes applies the same rule one layer up.

## Step 3: Span the stack

### Backend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg">
  <img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg">
</picture>

No table without a document behind it, and no API without a test on it. Prisma, Swagger, and TypeScript form one graph:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  claims: [
    {
      name: "schema models the documents",
      type: "prisma",
      files: ["prisma/schema.prisma"],
      symbol: "model",
      reference: {
        type: "markdown",
        files: ["docs/requirements/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "operations expose the schema and the documents",
      type: "swagger",
      files: ["packages/api/swagger.json"],
      reference: [
        { type: "prisma", files: ["prisma/schema.prisma"], symbol: "model" },
        { type: "markdown", files: ["docs/requirements/**/*.md"], symbol: ["h2", "h3"] },
      ],
    },
    {
      name: "tests exercise every operation",
      type: "typescript",
      files: ["test/features/**/*.ts"],
      symbol: "function",
      reference: {
        type: "swagger",
        file: "packages/api/swagger.json",
        noEvidenceExclude: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
```

- Prisma: `/// @evidence docs/requirements/orders.md#order-lifecycle Persists every state the lifecycle names.`
- Swagger `description`: `@evidence prisma:Order Reads and transitions the persisted order.`
- Test: `/** @evidence POST:/orders/{orderId}/coupons Rejects an over-stacked coupon set. */`

### Frontend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg">
  <img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg">
</picture>

The first layer is a document somebody else publishes:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  claims: [
    {
      name: "hooks call published operations",
      type: "typescript",
      files: ["src/hooks/**/*.ts"],
      symbol: "function",
      reference: { type: "swagger", file: "https://api.example.com/swagger.json" },
    },
    {
      name: "screens render hooks",
      type: "typescript",
      files: ["src/screens/**/*.tsx"],
      symbol: "function",
      reference: { type: "typescript", files: ["src/hooks/**/*.ts"], symbol: "function" },
    },
    {
      name: "journeys walk through screens",
      type: "typescript",
      files: ["test/journeys/**/*.ts"],
      symbol: "function",
      reference: { type: "typescript", files: ["src/screens/**/*.tsx"], symbol: "function" },
    },
  ],
} satisfies IEvidenceConfig;
```

"The API is wired up but there is no screen yet" stops being a green check.

### Novels

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg">
  <img alt="Principles and Settings grounding Treatments, Scripts and Prose" src="https://ttsc.dev/evidence/novel-light.svg">
</picture>

The graph reads no meaning, so it works on any text. Every layer cites the principles for its purpose and the settings for facts; prose cites the script it executes. Editing a setting expires every review on it.

### What a green check means

Every unit was cited or excluded with a reason, every citation resolved, every required review matched the current content, and nothing was incomplete. Code that cannot answer a rule goes green only after becoming code that can.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

Measured upstream on `@ttsc/evidence`, which shares this package's graph semantics: one agent built four applications twice with the same model, with and without the graph. Without it, coverage landed between 51.6% and 85.5% and review consumed about 90% of all tokens. With it, every application reached 100%. See the [benchmark](https://ttsc.dev/docs/benchmark/evidence).

## Graph rules

A **claim** is a selected population whose hosts must cite. A **reference** is a selected population that forms one coverage denominator. Every claim/reference pair is an independent **obligation**: two references never pool coverage, and a second claim on the same reference owes its own citations. A claim `name` labels diagnostics and merges nothing.

A **unit** is one declaration that can enter a denominator. It may have several declaration sites and public addresses; a function exported from its file and from a barrel is one obligation. Overloads, partial declarations, and reopenings merge only where the language contract says they are one identity.

### Coverage

- `@evidence` on an eligible host covers its target and the target's selected descendants: a class covers its methods, a Markdown file its sections, a model its columns and relations.
- `@evidenceExclude` covers the same way while recording that the target does not apply. Evidence and exclusion scopes cannot overlap in one obligation.
- `noEvidenceExclude` refuses exclusions for a reference.
- `uniqueEvidence` allows at most one distinct positive host per reference unit.
- `singleEvidencePerSymbol` requires every selected host, tagged or not, to cite exactly one reference unit.
- `evidenceExcludeCarriers` narrows which claim files may carry exclusions; it never widens the claim.

### Checklists

A Markdown reference with `checklist: true` requires every selected host to answer every selected heading. A positive citation answers only the named heading; `@evidenceExclude docs/rules.md <reason>` excuses one host from the whole file. `checklist` cannot combine with `uniqueEvidence` or `singleEvidencePerSymbol`, and `evidenceExcludeCarriers` beside a checklist requires `noEvidenceExclude`.

### Reviews

A false tag removes the error, not the problem. `requireReview: true` demands a review of the same kind, on the same host, naming the same target, with the current fingerprint:

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Looks the handler up in the registry it was handed and branches on no known name.
 * @evidenceReview .agents/skills/principles/SKILL.md#no-hard-coding #3eb537a Searched the body for literal names and fixture values; found none.
 */
```

The fingerprint is seven hexadecimal characters over the cited unit and its subtree. Annotations and whitespace do not change it; content, descendants, and withdrawals do. When the cited text changes, the diagnostic prints the new value:

```bash
ERROR [graph-missing-review] claim[0] 'every function answers every engineering principle' (typescript) -> reference[0] (markdown)
Location: /workspace/app/src/resolve.ts:4:4
Subject: host typescript:file:2658869853:6473924464643875:comment:50, target ".agents/skills/principles/SKILL.md#no-hard-coding"
Claim 1 ('every function answers every engineering principle') reference 1: @evidence for '.agents/skills/principles/SKILL.md#no-hard-coding' has no matching @evidenceReview; the current scope fingerprint is '#3eb537a'.
Repair: Add '@evidenceReview .agents/skills/principles/SKILL.md#no-hard-coding #3eb537a <what you checked>' on the same semantic host.
```

Reviews never provide coverage. `@evidenceReview` pairs with `@evidence`; `@evidenceExcludeReview` pairs with `@evidenceExclude`. The checker handles omissions; humans handle falsehoods.

### States

| State | Result |
| --- | --- |
| A complete claim selects no units | Inactive. A healthy empty claim, not fabricated coverage. |
| An active claim has a complete reference with no units | `graph-empty-reference`; exit 1 at error severity. |
| A selected unit has no valid acknowledgement | Missing coverage; exit 1 at error severity. |
| A target is malformed, missing, hidden, ambiguous, or out of population | The exact outcome is reported. No nearby unit is chosen. |
| An artifact type has no certified adapter | Configuration fails; exit 2. |
| A source is unreadable, partially parsed, or has an unresolved export | The population is incomplete, derivative findings are suppressed, and exit is 2. |
| A claim is disabled or a claim or reference has effective severity `off` | Removed before loading; no obligation and no watch dependency. |

Incomplete analysis never passes as an empty population, and a resolved citation is never proof that its reason is true.

## Configuration

`evidence.config.ts` exports one `IEvidenceConfig`. Evidence evaluates it through the consumer's `ttsx`, validates it with `typia`, and rejects invalid policy combinations before reading any source. `.ts`, `.cts`, and `.mts` are accepted.

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  severity: "error",
  claims: [
    {
      name: "public services",
      type: "typescript",
      root: ".",
      files: ["src/**/*.ts", "!src/internal/**"],
      symbol: ["type", "function"],
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
        requireReview: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
```

### Root

| Property | Type | Default | Behavior |
| --- | --- | --- | --- |
| `claims` | `IEvidenceClaim[]` |  | At least one claim. Each claim is its own graph boundary. |
| `severity` | `"error" \| "warning" \| "off"` | `error` | Claims override the root; references override their claim. |

### Claim

| Property | Type | Default | Behavior |
| --- | --- | --- | --- |
| `type` | Artifact type |  | Selects the adapter directly, such as `typescript`, `rust`, `prisma`, `markdown`, `swagger`. |
| `files` | `string[]` |  | Ordered globs relative to `root`. Swagger claims glob local JSON/YAML documents. |
| `reference` | `IEvidenceReference \| IEvidenceReference[]` |  | One reference or an array of independent obligations. |
| `name` | `string` |  | Labels diagnostics. |
| `severity` | Evidence severity | root | `off` removes the claim before loading. |
| `disabled` | `boolean` | `false` | Validates the shape but loads nothing. |
| `root` | `string` | config directory | One directory, not a glob. |
| `symbol` | Symbol or nonempty array | family default | Selects claim hosts. |
| `evidenceExcludeCarriers` | `string[]` | all selected files | Narrows exclusions to matching selected files. |

### Reference

| Property | Type | Default | Behavior |
| --- | --- | --- | --- |
| `type` | Artifact type |  | Selects the referenced adapter independently of the claim. |
| `root` | `string` | config directory | Same rules as claim roots. |
| `symbol` | Symbol or nonempty array | family default | Selects the denominator. |
| `severity` | Evidence severity | claim | `off` removes the reference before loading. |
| `noEvidenceExclude` | `boolean` | `false` | Exclusions fail and provide no coverage. |
| `uniqueEvidence` | `boolean` | `false` | At most one distinct positive host per unit. |
| `singleEvidencePerSymbol` | `boolean` | `false` | Every selected host cites exactly one unit. |
| `requireReview` | `boolean` | `false` | Every acknowledgement needs a current review. |
| `checklist` | `boolean` | `false` | Markdown only. Every host answers every selected heading. |

### Source fields

| Role | Field |
| --- | --- |
| Programming, Markdown, or database claim or reference | `files: string[]`; database files form one schema snapshot |
| Swagger claim | `files: string[]` |
| Swagger reference | `file: string`; one local JSON/YAML path or HTTP(S) URL |

`type` chooses the language before file selection: `.h` follows `c`, `cpp`, or `objc`; `.m` follows `objc` or `matlab`; `.sql` follows the configured dialect. Evidence never infers a language from parsing.

### Symbol defaults

| Family | Symbols | Claim default | Reference default |
| --- | --- | --- | --- |
| Programming | `type`, `function`, `property` | `type`, `function`, `property` | `type` |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all | all |
| Database | `model`, `column`, `relation` | `model`, `column`, `relation` | `model` |
| Swagger | `operation` | `operation` | `operation` |

Structural ancestors stay addressable for aggregate citations whatever the selector. Lua has no `type` units and rejects that selector.

### Paths and globs

Relative roots resolve from the config file's directory, also under `--cwd`. Symbolic links and Windows junctions are accepted; drive-relative paths such as `C:docs` are rejected. Patterns run left to right, `!` excludes, and a later positive pattern reincludes. `*` stays in one segment, `**` crosses segments, and `?` matches one character. A bare `src` selects nothing; use `src/**`. Identity is case-sensitive on every platform.

### Severity

`error` findings make a complete check exit 1. `warning` findings stay in the report, and a warning-only check exits 0. Incomplete analysis exits 2 regardless of severity.

### Types

`IEvidenceConfig`, `IEvidenceClaim`, and `IEvidenceReference` build on `IEvidenceClaimBase<Type, SymbolKind>` and `IEvidenceReferenceBase<Type, SymbolKind>`, specialized as `IEvidenceProgrammingClaim`, `IEvidenceDatabaseClaim`, `IEvidenceMarkdownClaim`, `IEvidenceSwaggerClaim`, and the matching references. `EvidenceProgrammingType`, `EvidenceDatabaseType`, `EvidenceProgrammingSymbol`, `EvidenceDatabaseSymbol`, `EvidenceMarkdownSymbol`, and `EvidenceSeverity` enumerate the literals.

## Tags and targets

```text
@evidence <target> <reason>
@evidenceExclude <target> <reason>
@evidenceReview <target> [#fingerprint] <description>
@evidenceExcludeReview <target> [#fingerprint] <description>
```

Tags live in documentation attached to a public declaration. A target is one whitespace-free token; the prose is required. `{@link Symbol}` is rejected: addresses are file-qualified, not compiler-resolved. `@internal`, `@hidden`, and `@ignore` withdraw a declaration and its descendants.

### Programming addresses

`<path>#<accessor>`. The path resolves from the citing file and must be selected by the reference. Identifiers use dots; a segment with punctuation, whitespace, an operator, or arity uses JSON-string brackets, and tuple fields use `Pair[0]`.

| Declaration | Target |
| --- | --- |
| Function | `../calculator.ts#add` |
| TypeScript static member | `../SomeClass.ts#SomeClass.member` |
| TypeScript instance member | `../SomeClass.ts#SomeClass.prototype.member` |
| Literal member name | `../source.ts#Namespace["member.with.dots"]` |
| Python instance member | `../sale.py#Sale.prototype.total` |
| Go receiver method | `../sale.go#Sale.Calculate` |
| Rust trait implementation | `../sale.rs#Sale["impl Service"].run` |
| Java overload family | `../Sale.java#Sale.calculate` |
| C# generic type | ``../Box.cs#Shop["Box`1"]`` |
| C++ operator | `../sale.hpp#shop.Sale["operator +"]` |
| C struct field | `../sale.h#["struct Sale"].total` |
| Ruby singleton method | `../sale.rb#Shop.Sale.self.find` |
| Kotlin extension | `../Contract.kt#["extension(kotlin.String)"].measure` |
| Swift static operator | `../Contract.swift#Contract.static["+"]` |
| Scala object member | `../Contract.scala#demo["object Contract"].apply` |
| PHP property | `../contract.php#App.Contract.$value` |
| Objective-C instance selector | `../Widget.h#Widget["-send:to:"]` |
| Lua module field | `../contract.lua#module.run` |
| MATLAB package class method | `../+pkg/@Widget/Widget.m#pkg.Widget.run` |

TypeScript, JavaScript, and Python use `prototype` for instance members; other languages use the owner directly, and Ruby uses `self` for singleton methods. Aliases such as barrels add addresses without adding obligations.

### Markdown addresses

`docs/requirements.md` or `docs/requirements.md#anchor`, resolved from the reference root. A trailing `{#anchor}` wins; otherwise the heading is lowercased, punctuation removed, and whitespace collapsed to hyphens. Duplicate anchors make the address ambiguous. Tags go in HTML comments: before the first heading for the file, after a heading for that section. Code blocks and prose never host tags.

### Database addresses

Prisma uses `prisma:Sale` and `prisma:Sale.price` with no path; tags go in `///` documentation on models and fields. SQL dialects and DBML use file-qualified addresses such as `schema.sql#app.item.id`; relation segments are dialect-specific, and `evidence list` prints the escaped form.

### Swagger addresses

`POST:/sales` or `GET:/sales/{saleId}`: uppercase method, exact path. Tags go in each operation's `description`:

```yaml
paths:
  /sales:
    post:
      description: |
        Creates a sale.
        @evidence docs/requirements.md#sales Exposes the required sale creation operation.
```

### Outcomes

| Outcome | Meaning |
| --- | --- |
| `resolved` | Exactly one unit owns the address in this scope. |
| `missing-file` | The file is outside the reference snapshot. |
| `missing-member` | The file exists but publishes no matching accessor. |
| `out-of-population` | The unit exists but is outside this reference's selection. |
| `unsupported-host` | The target form cannot be resolved from this host's artifact. |
| `ambiguous` | Several units own the address. |
| `hidden` | The unit was withdrawn. |
| `malformed` | The target does not follow the artifact grammar. |
| `incomplete` | Analysis cannot decide safely. |

The resolver never falls back to a project-wide name.

## Languages

Every family can be a claim and a reference and can cite every other. Adapters run no compiler, preprocessor, macro, or build; a construct that could change the public surface and cannot be resolved makes analysis incomplete and the check exit 2. `evidence languages` prints the shipped registry.

### Programming languages

| Type | Files | Public surface | Documentation |
| --- | --- | --- | --- |
| `typescript` | `.ts`, `.cts`, `.mts`, `.tsx` | Static module exports and declaration files | Attached JSDoc |
| `javascript` | `.js`, `.jsx`, `.cjs`, `.mjs` | Static ESM exports and unconditional CommonJS initialization | Attached JSDoc |
| `python` | `.py`, `.pyi` | Module exports with static import and `__all__` resolution | Docstrings or adjacent `#` runs |
| `go` | `.go` | Exported package declarations with receiver ownership | Adjacent line or block comments |
| `rust` | `.rs` | Crate modules, public reexports, and nominal impl members | Doc comments or static `#[doc]` |
| `java` | `.java` | Source-public declarations, independent of JPMS | Attached Javadoc |
| `csharp` | `.cs` | Source-public declarations and partial identities | `///` or `/** */` XML documentation |
| `c` | `.c`, `.h` | External declarations, tags, typedefs, fields, enumerators per file | Attached Doxygen |
| `cpp` | `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.hh`, `.hxx`, `.ipp`, `.tpp`, `.ixx`, `.cppm` and other C++ spellings | Namespaces, public members, external declarations, templates, bounded aliases | Attached Doxygen |
| `ruby` | `.rb`, `.rake`, `.gemspec`, `Gemfile`, `Rakefile` | Classes, modules, public methods, constants, literal attributes, reopenings | Adjacent `#` runs or RDoc |
| `kotlin` | `.kt` | Public-by-default declarations, companions, resolvable extensions | Adjacent KDoc |
| `swift` | `.swift` | Public/open declarations of one module per root, extensions merged | `///` runs or `/** */` DocC |
| `php` | `.php` | Namespace declarations and public class members | Adjacent PHPDoc |
| `dart` | `.dart` | Non-underscore library declarations across `part` and relative `export` graphs | `///` groups or `/** */` |
| `scala` | `.scala` | Unrestricted Scala 2 and 3 declarations, named givens, object exports | Adjacent Scaladoc |
| `lua` | `.lua` | Explicit globals and one returned literal module table | `---` LuaDoc or long comments |
| `matlab` | `.m` | `classdef` types, primary functions, public members, `@Class` folders | Percent help comments |
| `objc` | `.m`, `.h` | Interfaces, protocols, categories, methods, properties, `@public` ivars | Doxygen blocks or `///` and `//!` lines |
| `zig` | `.zig` | `pub` declarations, exposed container fields, direct aliases | Adjacent `///` |

Every adapter maps its language onto `type`, `function`, and `property`, keeps undocumented public declarations in the population, and ignores tags inside code examples, strings, and ordinary comments.

<details>
<summary><strong>TypeScript</strong></summary>

- **Units.** Exported interfaces, type aliases, classes, and namespaces are `type`. Function declarations, function-valued `const` bindings, public methods, and function fields are `function`. Other exports and public fields are `property`. Constructors, accessors, private members, computed names, index signatures, and enums form no units.
- **Addresses.** `Class.member` for static members, `Class.prototype.member` for instance members and parameter properties, owner-direct for interface members.
- **Exports.** Direct, aliased, default, re-exported, star, and namespace exports resolve through relative snapshot paths with `.js` to `.ts` substitution. Explicit exports shadow star candidates; competing stars stay ambiguous. Type-only exports keep only type-space units.
- **Boundaries.** Package `exports`, path aliases, ambient modules, global augmentations, UMD namespaces, CommonJS `export =`, and unreachable export cycles are incomplete. The pinned grammar does not parse `export type *`.

</details>

<details>
<summary><strong>JavaScript</strong></summary>

- **Modules.** `.mjs` is ESM, `.cjs` is CommonJS, and `.js` or `.jsx` follows the nearest `package.json` `type`, defaulting to CommonJS.
- **Units.** Exported classes are `type`; functions, generators, function-valued `const` bindings, methods, and function fields are `function`; other exports and public fields are `property`. Anonymous defaults use the `default` address.
- **CommonJS.** Unconditional top-level `exports.name = local`, `module.exports.name = local`, `module.exports = local`, and `module.exports = { name, alias: local }`. Replacing `module.exports` clears earlier names; `exports = module.exports` reconnects them.
- **Boundaries.** Computed keys, conditional or dynamic mutation, inline values, shadowed bindings, and escaped aliases are incomplete.

</details>

<details>
<summary><strong>Python</strong></summary>

- **Units.** Classes and explicit type aliases are `type`; functions and methods are `function`; simple assignments and `self.name` assignments in `__init__` are `property`. Leading-underscore members and special methods are excluded.
- **Addresses.** `Class.member` for static and class methods, `Class.prototype.member` for instance methods, properties, and fields.
- **Exports.** Static `__all__` lists, tuples, `+` composition, and `+=` additions; otherwise non-underscore declarations and statically resolved imports. Relative imports resolve from the package, absolute imports from the root, through snapshot modules and `__init__` files.
- **Documentation.** A class or function docstring, or a same-indent `#` run before the declaration or its decorators.
- **Boundaries.** Missing local sources, unresolved names, conditional declarations, and dynamic `__all__` mutation are incomplete.

</details>

<details>
<summary><strong>Go</strong></summary>

- **Units.** Exported types and aliases are `type`; package functions, receiver methods, and interface methods are `function`; constants, variables, and struct fields are `property`. Selected files form package populations; external `_test` packages stay distinct.
- **Addresses.** `Type.Method`, resolvable through the method's file or the owner type's file.
- **Documentation.** Adjacent standalone `//` runs and block comments. A grouped declaration's comment hosts every member of the group.
- **Boundaries.** Build tags, platform file names, promoted members, and generated declarations absent from the snapshot; conflicting build variants and missing receiver owners are incomplete.

</details>

<details>
<summary><strong>Rust</strong></summary>

- **Units.** Public modules, structs, enums, traits, type aliases, and associated types are `type`; free functions, inherent methods, and trait methods are `function`; fields, tuple fields, constants, statics, enum variants, and associated constants are `property`.
- **Visibility.** Unrestricted `pub` only. `mod name;` files, inline modules, and named, grouped, wildcard, and chained `pub use` keep one identity across aliases.
- **Addresses.** `Type.member` for inherent members; `Sale["impl crate::Service"].run` for trait implementations; `Pair[0]` for tuple fields.
- **Documentation.** Outer and inner doc comments and static `#[doc = "..."]`.
- **Boundaries.** Cargo features, macros, `#[path]`, missing or ambiguous module files, unresolved reexports, `cfg` alternatives, and external impl ownership are incomplete.

</details>

<details>
<summary><strong>Java</strong></summary>

- **Units.** Public classes, interfaces, enums, annotations, records, and reachable nested types are `type`; public methods are `function`; fields, constants, record components, enum constants, and annotation elements are `property`. Constructors and generated members form no units.
- **Addresses.** `Sale.java#Sale.calculate`; methods with one owner and name are one overload family. A field and method sharing a spelling are disambiguated by the reference `symbol`.
- **Documentation.** Attached Javadoc across annotations. `{@code}`, `{@literal}`, `{@snippet}`, `<code>`, and `<pre>` content is inert.
- **Boundaries.** JPMS exports, annotation processors, and generated source not selected.

</details>

<details>
<summary><strong>C#</strong></summary>

- **Units.** Public classes, structs, interfaces, records, enums, delegates, and nested types are `type`; methods and operators are `function`; fields, properties, events, enum members, and indexers are `property`. Constructors, explicit interface implementations, and positional record properties form no units.
- **Addresses.** Namespaced: `Sale.cs#Shop.Sale.Total`. Indexers use `["this[]"]`, operators `["operator +"]`, generics ``["Box`1"]`` with `Shop.Box` as an alias when one arity owns it. Partial declarations share one unit within a configured root.
- **Visibility.** `public` at every level, except interface members and types declared in interfaces.
- **Documentation.** Attached `///` or `/** */` XML; `<c>`, `<code>`, `<example>`, and `<pre>` are inert.
- **Boundaries.** Declaration-position conditional compilation is incomplete. Source generators are never run.

</details>

<details>
<summary><strong>C</strong></summary>

- **Units.** Named structs, unions, enums, and typedefs are `type`; non-static functions are `function`; non-static objects, aggregate fields, and enumerators are `property`. A prototype and definition merge within one file; header and source declarations stay separate.
- **Addresses.** `models.h#["struct Sale"]`, with `models.h#Sale` when unambiguous or supplied by a direct typedef. Unnamed struct or union members promote their fields.
- **Documentation.** Attached leading or trailing Doxygen.
- **Boundaries.** Include guards and `#pragma once` are accepted; other conditional preprocessing, declaration-position macros, and directives are incomplete. Includes are not traversed.

</details>

<details>
<summary><strong>C++</strong></summary>

- **Units.** Namespaces, classes, structs, unions, enums, aliases, typedefs, and concepts are `type`; functions, constructors, destructors, operators, and conversions are `function`; external variables, public fields, static data members, and enumerators are `property`.
- **Addresses.** Namespaces, owners, and arity: ``shop["Box`1"].value``, `constructor`, `destructor`, `["operator +"]`. Header declarations and qualified definitions merge; `using` declarations and namespace aliases add addresses when they resolve to one unit.
- **Visibility.** Class members default private, struct members public; namespace-scope `static`, `const`, `constexpr`, and anonymous namespaces are excluded.
- **Boundaries.** Preprocessing, macros, includes, specialization, inheritance, friends, modules, and linker visibility.

</details>

<details>
<summary><strong>Ruby</strong></summary>

- **Units.** Classes and modules are `type`; public instance and singleton methods and aliases are `function`; constants and literal `attr_*` declarations are `property`.
- **Addresses.** `Shop.Sale.total`, `Shop.Sale.self.find`, `Shop.Sale["price="]`.
- **Visibility.** Lexical `public`, `private`, `protected`, named visibility calls, and `module_function`. Compatible reopenings merge; conflicts are incomplete. Top-level methods form no units.
- **Documentation.** Adjacent same-indent `#` runs and column-zero `=begin`/`=end` RDoc.
- **Boundaries.** Load order, `define_method`, `class_eval`, refinements, and mixins.

</details>

<details>
<summary><strong>Kotlin</strong></summary>

- **Units.** Classes, interfaces, objects, companions, and type aliases are `type`; functions are `function` in overload families; properties, primary-constructor `val`/`var`, and enum entries are `property`.
- **Addresses.** `Contract.kt#Contract.Companion.run`, named companions by name, extensions as `["extension(kotlin.String)"].measure`. Backtick names are literal segments.
- **Visibility.** Public by default. Overrides without explicit visibility, `expect`/`actual`, and delegation are incomplete. `.kts` is rejected.
- **Documentation.** Adjacent KDoc before annotations.
- **Boundaries.** Generic, function-type, cyclic, or unresolved extension receivers. The pinned grammar needs a separator before some closing class-body braces.

</details>

<details>
<summary><strong>Swift</strong></summary>

- **Modules.** One module per population root; targets are not inferred.
- **Units.** Public/open classes, structs, actors, enums, protocols, nested types, aliases, and associated types are `type`; functions, initializers, subscripts, and operators are `function`; properties, constants, and cases are `property`. Members of a public type default to internal.
- **Addresses.** `Contract.swift#Contract.init`, `Contract.subscript`, `Contract.static["+"]`; overloads share one identity.
- **Extensions.** Merge under the selected owner; `public extension` defaults members to public within the owner's bound.
- **Boundaries.** Macros, conditional compilation, constrained or external extensions, extension-added conformances, and synthesized members.

</details>

<details>
<summary><strong>PHP</strong></summary>

- **Units.** Classes, interfaces, traits, and enums are `type`; functions and methods are `function`; properties, promoted properties, constants, and cases are `property`. Files need an opening PHP tag.
- **Addresses.** `contract.php#App.Contract.run`, `App.Contract.VALUE`, `App.Contract.$value`. Omitted visibility is public.
- **Documentation.** Adjacent `/** */` PHPDoc across attributes.
- **Boundaries.** Trait composition, declarations in executable blocks, `include`, `require`, `eval`, `define`, `class_alias`, autoloading, and undeclared `$this` writes.

</details>

<details>
<summary><strong>Dart</strong></summary>

- **Units.** Classes, mixins, enums, named extensions, extension types, and typedefs are `type`; functions, methods, constructors, and operators are `function`; variables, fields, constants, and getter/setter pairs are `property`. Underscore names are private.
- **Addresses.** `api.dart#Contract.new`, `Contract.named`, `Contract["operator +"]`.
- **Libraries.** Select the whole library graph; `part` directives must agree, and relative `export` with `show`/`hide` adds aliases.
- **Boundaries.** Package or SDK export URIs, conditional exports, augmentations, and missing parts.

</details>

<details>
<summary><strong>Scala</strong></summary>

- **Units.** Classes, traits, objects, package objects, enums, type aliases, and abstract types are `type`; methods and extension methods are `function`; values, variables, named givens, cases, and constructor parameters are `property`. Synthesized members form no units.
- **Addresses.** `Contract.scala#demo.Contract.run`, `demo["object Contract"].apply`, `demo["package object util"].ready`. Companions never merge.
- **Exports.** Named exports from selected objects add aliases; container, chained, wildcard, and given exports are incomplete.
- **Boundaries.** Anonymous givens, `derives`, macros, structural types, and `.sc` scripts.

</details>

<details>
<summary><strong>Lua</strong></summary>

- **Units.** Global functions and variables, plus locals exposed through the returned module table. Callables are `function`, tables and fields `property`; there is no `type`.
- **Addresses.** `contract.lua#module` and `contract.lua#module.run`; string keys are literal segments; dot and colon methods share one address.
- **Documentation.** Adjacent `---` LuaDoc groups and long comments.
- **Boundaries.** Metatables, `require`, chunk-level control flow, cycles, reassignment, shadowing, and tables escaping through calls or returns.

</details>

<details>
<summary><strong>MATLAB</strong></summary>

- **Units.** `classdef` is `type`; primary functions, methods, constructors, and abstract signatures are `function`; properties, enumeration members, and events are `property`. The primary name must match the file.
- **Addresses.** `+pkg/@Widget/Widget.m#pkg.Widget.run`; `@Class` folder methods resolve through the class file.
- **Documentation.** Percent help after a signature, or before or beside a member.
- **Boundaries.** `dynamicprops`, `eval`, `feval`, `str2func`, legacy `class`, unknown attributes, and missing class folders. The pinned grammar needs a newline after a `classdef`'s closing `end`.

</details>

<details>
<summary><strong>Objective-C</strong></summary>

- **Units.** Interfaces, protocols, and named categories are `type`; methods and external C functions are `function`; properties and `@public` ivars are `property`. Configure `type: "objc"` explicitly; `.mm` is rejected.
- **Addresses.** `Widget.h#Widget["-send:to:"]`, `["+send:to:"]`, `Widget["class:value"]`, `Widget["ivar:value"]`, `["Widget(Extras)"]["-extra"]`, `["protocol(Widget)"]["-run"]`.
- **Documentation.** `/** */`, `/*! */`, `///`, and `//!`.
- **Boundaries.** Header traversal, non-guard preprocessing, macros, C typedefs and aggregates, and Objective-C++.

</details>

<details>
<summary><strong>Zig</strong></summary>

- **Units.** `pub` structs, enums, unions, opaque types, error sets, and type values are `type`; functions are `function`; variables, constants, fields, cases, and error names are `property`. Fields of an exposed container need no `pub`.
- **Addresses.** `contract.zig#Contract.run`; quoted identifiers are literal segments; same-container aliases expose the canonical declaration.
- **Documentation.** Adjacent `///`.
- **Boundaries.** `usingnamespace`, qualified aliases, imported namespaces, comptime blocks, type-producing functions, and build options. The pinned grammar rejects empty `struct {}`.

</details>

### Database schema languages

Database adapters share `model`, `column`, and `relation`. Select the schema language, not the server. Selected files are a declared schema snapshot: migrations, `ALTER` beyond the PostgreSQL forms below, `DROP`, views, and executable statements are incomplete, and no adapter runs SQL.

| Type | Files | Units | Documentation |
| --- | --- | --- | --- |
| `prisma` | `.prisma` | Models and views; parser output decides column versus relation | `///` on models and fields |
| `postgresql` | `.sql` | `schema.table` tables, columns, foreign keys, `ALTER TABLE ADD COLUMN`, named `ADD CONSTRAINT` | Adjacent `--` or block comments, `COMMENT ON` |
| `mysql` | `.sql` | `CREATE TABLE` tables, columns, table `FOREIGN KEY` | Adjacent comments, `COMMENT` strings |
| `sqlite` | `.sql`, `.sqlite` | `CREATE TABLE` tables, columns, inline or table foreign keys | Leading `--` runs or one block comment |
| `bigquery` | `.sql`, `.bqsql` | `CREATE TABLE` tables, scalar, repeated, and `STRUCT` fields, `NOT ENFORCED` foreign keys | Leading `--`, `#`, or block comments, `OPTIONS(description)` |
| `sql` | `.sql` | Portable `CREATE TABLE` with standard scalar types, inline `REFERENCES`, anonymous `FOREIGN KEY` | Leading `--` runs or block comments |
| `dbml` | `.dbml` | Tables, scalar fields, inline or standalone `Ref` relations | Notes or adjacent standalone comments |

<details>
<summary><strong>Dialect addresses and limits</strong></summary>

- **Prisma.** `prisma:Sale.price`; no path. Enums, composite types, indexes, generators, and datasources form no units. An unattached `///` run may host an exclusion only. A parser visible from the project root is preferred over the pinned copy.
- **PostgreSQL.** Unquoted identifiers fold to lowercase: `schema.sql#app.item.id`, `app["Order.Item"]["Item.ID"]`. Explicit `schema.table` is required. Anonymous relations use `["foreign key [\"owner_id\"] references [\"app\",\"owner\",\"id\"]"]`; named constraints use `["constraint owner_fk"]`. Names over 63 bytes and named keys inside `CREATE TABLE` are rejected.
- **MySQL.** Source-spelled segments: `schema.sql#Store.Child.parent_id`. Relations use `Child["foreign-key:[\"parent_id\"]->[\"Parent\"]([\"id\"])"]`; inline `REFERENCES` adds none. `CONSTRAINT name FOREIGN KEY` is unsupported by the pinned grammar.
- **SQLite.** ASCII-insensitive identities: `schema.sql#Account.owner`, aliases `main.Account.owner` and `temp.Account.owner`. Named keys use `Account["foreign key:owner_link"]`.
- **BigQuery.** `schema.sql#project.dataset.orders.id`; backticked paths split into segments, nested `STRUCT` fields are `orders.details.sku`, quoted names use `["display name"]`.
- **Portable SQL.** Uppercase regular identifiers, literal quoted identifiers; anonymous keys use `foreign-key:["ID"]->["PARENT"](["ID"])`. Never retries another dialect.
- **DBML.** `schema.dbml#public.users.id`, `users.id`, and table aliases name one column; named relations use `posts["$ref:owner"]`. Partials, table groups, imports, and `?` modifiers are incomplete.

</details>

### Markdown and Swagger

Markdown yields one `file` unit and one unit per ATX `h1` to `h4`; HTML comments are the only hosts. Swagger 2.0 and OpenAPI 3.x JSON or YAML yield `METHOD:/path` operations; each operation's `description` hosts tags, and its fingerprint covers its normalized content and referenced local components. A Swagger reference by URL is fetched on every load with a 30-second timeout and a 16 MiB limit.

## CLI

```text
evidence [check] [options]
evidence list [options]
evidence inspect <target> [options]
evidence graph [options]
evidence languages [options]
evidence init [options]
```

| Command | Config | Purpose | Formats |
| --- | --- | --- | --- |
| `check` | Yes | Evaluate every enabled obligation. Default command. | `text`, `json` |
| `list` | Yes | List selected units and addressable ancestors with canonical targets. | `text`, `json` |
| `inspect <target>` | Yes | Resolve one target in every scope and show its fingerprint and citations. | `text`, `json` |
| `graph` | Yes | Export boundaries, nodes, edges, reviews, and diagnostics. | `json`, `mermaid`, `dot` |
| `languages` | No | Print the certified adapter registry. | `text`, `json` |
| `init` | No | Create a typed starter config without overwriting. |  |

| Option | Commands | Behavior |
| --- | --- | --- |
| `-c, --config <path>` | check, list, inspect, graph, init | Config path, default `evidence.config.ts`, resolved from `--cwd`. |
| `--cwd <path>` | check, list, inspect, graph, languages, init | Resolve CLI paths from another directory. Roots still anchor at the config file. |
| `--format <value>` | check, list, inspect, graph, languages | Output format from the table above. |
| `-o, --output <path>` | check, list, inspect, graph, languages | Write the result to a file and keep stdout empty. Parent directories are not created. |
| `--language <type>` | list | Keep one artifact type. |
| `--kind <symbol>` | list | Keep one symbol kind. |
| `-w, --watch` | check | Recheck when an active dependency changes. |
| `-h, --help`, `-v, --version` |  | Print help or the version without loading anything. |

`check`, `list`, `inspect`, and `graph` evaluate the complete graph first; filters never change the denominator. JSON reports carry `schemaVersion: 1`. Watch polls every 250 milliseconds with a 100-millisecond quiet period, reevaluates from scratch, and emits text blocks or NDJSON per cycle; Ctrl+C exits 0.

| Exit | Meaning |
| --- | --- |
| 0 | Complete analysis with no error findings. Warning-only checks also exit 0. |
| 1 | Complete analysis with errors, or an inspection that cannot resolve its target. |
| 2 | Invalid command or configuration, incomplete analysis, or a failed output write. |

## Programmatic API

Importing the package starts no parser, loads no configuration, and runs no command.

```ts
import { EvidenceChecker, EvidenceReporter } from "@wrtnlabs/evidence";
import type { IEvidenceCheckReport } from "@wrtnlabs/evidence";

const report: IEvidenceCheckReport = await EvidenceChecker.check("evidence.config.ts");
process.stdout.write(EvidenceReporter.render(report, "text"));
process.exitCode = report.exitCode;
```

| Entry point | Purpose |
| --- | --- |
| `EvidenceChecker.check` / `analyze` / `evaluate` | Run a check and return the report, the report with its graph input and result, or evaluate a validated plan. |
| `new EvidenceQuery(analysis, cwd)` | `list`, `inspect`, and `graph` over one captured analysis; reports are independent copies. |
| `EvidenceReporter`, `EvidenceQueryReporter`, `EvidenceGraphReporter`, `EvidenceWatchReporter` | Render reports as text, JSON, Mermaid, or DOT. |
| `EvidenceCommand.run(args)` / `parse(args)` | Run a finite CLI command with buffered output, or parse without running. Watch is rejected. |
| `new EvidenceWatcher(configFile, options)` | `watch(callback)`, `dependencies()`, `close()`; options `pollIntervalMilliseconds`, `debounceMilliseconds`, `parserRetryMilliseconds`. |
| `EvidenceConfigLoader.load` / `plan` | Validated authored config, or the plan with defaults resolved and inactive populations removed. |
| `EvidenceSourceLoader.glob` / `file` | Load one population or one file as a snapshot with digests, aliases, dependencies, and completeness. |
| `new EvidenceParser({ concurrency })` | `parse(input, callback)` with a borrowed tree and query helpers; `close()` drains sessions. |
| `EvidenceLanguageRegistry` | `list()`, `databases()`, `candidates()`, `select(type, file)`. |
| `Evidence*Adapter` | Every certified adapter, each implementing `IEvidenceAdapter.analyze(snapshot)`. |
| `EvidenceInventory`, `EvidenceGraph`, `EvidenceFingerprint` | Combine inventories, evaluate a materialized graph, inspect a unit's fingerprint. |
| `EvidenceTagParser`, `EvidenceDocumentation`, `EvidenceAccessor`, `EvidenceFileTarget`, `EvidenceTargetResolver` | Parse tags, map documentation, and resolve targets as the checker does. |

```ts
import { EvidenceParser } from "@wrtnlabs/evidence";

const parser = new EvidenceParser();
try {
  const names: string[] = await parser.parse(
    { type: "typescript", file: "calculator.ts", content: "export function add() {}" },
    (session) =>
      session
        .captures("(function_declaration name: (identifier) @name)")
        .map((capture) => capture.node.text),
  );
} finally {
  await parser.close();
}
```

Copy values out of the callback before it returns; the tree is released afterwards. Parse failures throw `EvidenceParserError` with a stable `code` instead of returning partial captures.

## Grammar cache

The package ships no grammar WASM. A manifest pins each grammar's repository, commit, URL, SHA-256, size, and license. The first selected source of a language downloads its grammar and verifies it; every later read verifies it again.

| Platform | Directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\wrtnlabs\evidence\Cache` |
| macOS | `~/Library/Caches/wrtnlabs/evidence` |
| Linux | `$XDG_CACHE_HOME/wrtnlabs/evidence` or `~/.cache/wrtnlabs/evidence` |

`EVIDENCE_CACHE_DIR` overrides the location. A cold cache needs network access once; a checksum mismatch exits 2. Cache the directory in CI.

## Related

- [Evidence Graph: Make Every SKILL Instruction 100% Enforced](https://ttsc.dev/blog/evidence-graph-make-every-skill-instruction-100-percent-enforced/), the article this README follows.
- [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence), the compiler-integrated variant for TypeScript projects on `ttsc`.
- [`ttsc`](https://github.com/samchon/ttsc), the TypeScript-Go toolchain whose `ttsx` evaluates `evidence.config.ts`.
- [Benchmark](https://ttsc.dev/docs/benchmark/evidence) and [raw sessions](https://github.com/samchon/evidence-benchmark-results).

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/wrtnlabs/evidence/blob/master/LICENSE).
