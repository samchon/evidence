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

Four sentences the agent must write before the check passes: what the component takes from the requirement, which hook it renders, how it honors a principle, and why another principle does not apply. Delete the hook line and the check stops:

```bash
$ npx evidence
Evidence check complete.
Coverage: 3/4 units covered, 1 missing.

ERROR [graph-missing-acknowledgement] claim[0] 'components' (typescript) -> reference[1] (typescript)
Location: /workspace/app/src/hooks/useCouponStacking.ts:1:1
Claim 1 ('components') reference 2: Missing acknowledgement for '/workspace/app/src/hooks/useCouponStacking.ts#useCouponStacking'.
Repair: Cite the claim artifact that implements this unit with @evidence, or exclude it on an eligible carrier when it does not apply.
```

The error list is the task list. Evidence reads 19 programming languages, 7 database schema languages, Markdown, and Swagger from source, with no compiler or build of the checked project.

## Setup

```bash
npm install -D typescript ttsc @wrtnlabs/evidence
npx evidence init
npx evidence
```

`typescript` and [`ttsc`](https://github.com/samchon/ttsc) are peer dependencies; `ttsc` supplies `ttsx`, which evaluates `evidence.config.ts` without a project `tsconfig.json`. Grammars download on first use. [Step 1](#step-1-enforce-your-principles) fills the config in.

## Why a graph

You wrote the rules down. `AGENTS.md`, `CLAUDE.md`, a skill file; the name does not matter.

```markdown
## No hard coding {#no-hard-coding}
## Fix causes, not symptoms {#fix-root-causes}
## Do not build it before you need it {#yagni}
```

The agent reads all of it and says it understands. Four hours later, this is in the commit:

```ts
if (file === "wide-chars.ts") return WIDE_CHARS_EXPECTED;
```

That breaks the first rule, and the build passes. The type checker looks at types, the tests look for green, the linter looks for unused variables. The rules live in a document, and the build does not read documents.

Writing them harder does not help. [One study](https://arxiv.org/abs/2605.01771) read the tool logs: six frontier models followed a written instruction in 0 of 60 runs, and reported compliance in more than 90% of them. This is not malice; if there is a cheaper way to pass the check, [that is the way it goes](https://debugml.github.io/cheating-agents).

So the checker asks. Every function answers every rule in its own documentation comment, one sentence per rule:

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Looks the handler up in the registry it was handed and branches on no known name.
 * @evidence .agents/skills/principles/SKILL.md#fix-root-causes Rejects an unknown name at the lookup instead of retrying a failed call later.
 * @evidence .agents/skills/principles/SKILL.md#yagni One lookup and one throw, with no cache or index built ahead of time.
 */
export function resolveHandler(name: string, registry: Map<string, Handler>): Handler;
```

Suppose the agent special-cased a fixture name. The honest answer to `#no-hard-coding` reads "Branches on the fixture name so the snapshot test passes." Two options: write that sentence, or fix the code so it never has to be written. In practice it fixes the code.

The checker cannot tell whether a sentence is true. That is the reviewer's job, and it is now three sentences beside each function instead of a 4,000-line diff. The checklist lives in the repository, so it survives the session and runs in CI.

## Step 1: Enforce your principles

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

```bash
$ npx evidence
Evidence check complete.
Coverage: 0/3 units covered, 3 missing.

ERROR [graph-checklist-missing] claim[0] 'every function answers every engineering principle' (typescript) -> reference[0] (markdown)
Location: /workspace/app/src/resolve.ts:3:1
Claim 1 ('every function answers every engineering principle') reference 1: Host '/workspace/app/src/resolve.ts#resolveHandler' has not acknowledged 3 of 3 checklist item(s): '/workspace/app/.agents/skills/principles/SKILL.md#["fix-root-causes"]', '/workspace/app/.agents/skills/principles/SKILL.md#["no-hard-coding"]', '/workspace/app/.agents/skills/principles/SKILL.md#yagni'.
Repair: Cite every missing checklist item from this host, or exclude the scope that does not apply.
```

On an existing repository this is hundreds of errors: the real distance between your rule file and your code. Paying it down is not your job. Add this to `AGENTS.md`:

```markdown
## Evidence

Run `npx evidence` before finishing any task. Every error names an obligation and its repair.
Do the work first, then write the `@evidence` line on the declaration that supplies it, stating why in one sentence.
Never write a tag to silence an error. Never weaken `evidence.config.ts` to pass.
Use `npx evidence list` to find an address and `npx evidence inspect '<target>'` to see why one does not resolve.
```

The agent works through the list, fixing code wherever an honest answer cannot be written, and the check goes green:

```bash
$ npx evidence
Evidence check complete.
Coverage: 3/3 units covered, 0 missing.
```

Run the same command in CI and keep its exit code: 1 is a violation, 2 is incomplete analysis. `requireReview: true` on the reference also demands an `@evidenceReview` per answer that expires when the rule's text changes; see [Reviews](#reviews).

## Step 2: Ground code in requirements

The checker reads no meaning, only who cited what, so anything with an address can be cited.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg">
  <img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg">
</picture>

Each arrow is one claim. Requirements cite idea notes, so a dropped idea is caught before code exists. Tests cite requirements and implementation, so an untested feature never passes. Whichever layer a human reviews last is the source of truth; the agent writes everything below it.

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
      reference: { type: "markdown", files: ["docs/requirements.md"], symbol: "h2" },
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

Every requirement must be cited by a function under `src`; every function under `src` must be cited by a test, with no exclusions. With one requirement, `src/calculator.ts` exporting `add`, and `test/calculator.test.ts` exporting `test_add`, the first check fails twice:

```md
## Exact addition {#exact-addition}

Add prices without intermediate rounding.
```

```bash
$ npx evidence
Evidence check complete.
Coverage: 0/2 units covered, 2 missing.

ERROR [graph-missing-acknowledgement] claim[0] 'implementation' (typescript) -> reference[0] (markdown)
Location: /workspace/app/docs/requirements.md:3:1
Claim 1 ('implementation') reference 1: Missing acknowledgement for '/workspace/app/docs/requirements.md#["exact-addition"]'.
Repair: Cite the claim artifact that implements this unit with @evidence, or exclude it on an eligible carrier when it does not apply.

ERROR [graph-missing-acknowledgement] claim[1] 'tests' (typescript) -> reference[0] (typescript)
Location: /workspace/app/src/calculator.ts:1:1
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
/** @evidence ../src/calculator.ts#add Verifies exact addition through the public function. */
export function test_add(): void {
  if (add(1, 2) !== 3) throw new Error("Unexpected sum.");
}
```

```bash
$ npx evidence
Evidence check complete.
Coverage: 2/2 units covered, 0 missing.
```

Evidence checked two edges. It did not run `test_add` and did not prove either sentence true. One layer up, Markdown cites Markdown in HTML comments, so the rendered document stays clean:

```md
## Coupon stacking {#coupon-stacking}

<!-- @evidence ideas/2026-03-checkout.md#stacking-limit Turns the note's per-issuer idea into a testable limit. -->

A buyer may apply at most one coupon per issuer to one order.
```

## Step 3: Span the stack

### Backend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg">
  <img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg">
</picture>

No table without a document behind it, and no API without a test on it:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  claims: [
    {
      name: "schema models the documents",
      type: "prisma",
      files: ["prisma/schema.prisma"],
      symbol: "model",
      reference: { type: "markdown", files: ["docs/requirements/**/*.md"], symbol: ["h2", "h3"] },
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
      reference: { type: "swagger", file: "packages/api/swagger.json", noEvidenceExclude: true },
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

The graph reads no meaning, so it works on any text: prose cites the script it executes, and editing a setting expires every review on it.

### What a green check means

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

Measured upstream on `@ttsc/evidence`, which shares this package's graph semantics: one agent built four applications twice with the same model, with and without the graph. Without it, coverage landed between 51.6% and 85.5% and review consumed about 90% of all tokens. With it, every application reached 100%. See the [benchmark](https://ttsc.dev/docs/benchmark/evidence).

## Graph rules

A **claim** is a population whose hosts must cite; a **reference** is a population that forms one coverage denominator. Every claim/reference pair is an independent obligation: two references never pool coverage, and a claim `name` merges nothing. A **unit** is one declaration; a function exported from its file and from a barrel is one unit with two addresses.

### Coverage

- `@evidence` covers its target and the target's selected descendants: a class covers its methods, a file its sections, a model its columns.
- `@evidenceExclude` covers the same way while recording that the target does not apply. The two cannot overlap in one obligation.
- `noEvidenceExclude` refuses exclusions. `uniqueEvidence` allows at most one positive host per unit. `singleEvidencePerSymbol` requires every host, tagged or not, to cite exactly one unit. `evidenceExcludeCarriers` limits which claim files may carry exclusions.
- `checklist` (Markdown references) requires every host to answer every selected heading; `@evidenceExclude docs/rules.md <reason>` excuses one host from the whole file. It cannot combine with `uniqueEvidence` or `singleEvidencePerSymbol`.

### Reviews

A false tag removes the error, not the problem. `requireReview: true` demands a review of the same kind, on the same host, naming the same target, with the current fingerprint:

```ts
/**
 * @evidence .agents/skills/principles/SKILL.md#no-hard-coding Looks the handler up in the registry it was handed and branches on no known name.
 * @evidenceReview .agents/skills/principles/SKILL.md#no-hard-coding #6385235 Searched the body for literal names and fixture values; found none.
 */
```

The fingerprint is seven hexadecimal characters over the cited unit and its subtree. Annotations and whitespace do not change it; content does, and the diagnostic then prints the new value:

```bash
ERROR [graph-missing-review] claim[0] 'every function answers every engineering principle' (typescript) -> reference[0] (markdown)
Location: /workspace/app/src/resolve.ts:4:4
Claim 1 ('every function answers every engineering principle') reference 1: @evidence for '.agents/skills/principles/SKILL.md#no-hard-coding' has no matching @evidenceReview; the current scope fingerprint is '#6385235'.
Repair: Add '@evidenceReview .agents/skills/principles/SKILL.md#no-hard-coding #6385235 <what you checked>' on the same semantic host.
```

Reviews never provide coverage. `@evidenceReview` pairs with `@evidence`; `@evidenceExcludeReview` pairs with `@evidenceExclude`. A fingerprint version upgrade expires every review once; re-review before updating the value. The checker handles omissions; humans handle falsehoods.

### States

| State | Result |
| --- | --- |
| A claim selects no units | Inactive, not fabricated coverage. |
| A reference selects no units | `graph-empty-reference`; exit 1. |
| A unit has no valid acknowledgement | Missing coverage; exit 1. |
| A source is unreadable, partially parsed, or unresolved | The population is incomplete, derivative findings are suppressed; exit 2. |
| A claim is disabled or has effective severity `off` | Removed before loading. |

Incomplete analysis never passes as an empty population, and a resolved citation is never proof that its reason is true.

## Configuration

`evidence.config.ts` exports one `IEvidenceConfig`: `claims` and an optional root `severity`. It is evaluated through the consumer's `ttsx` and validated with `typia` before any source is read.

### Claim

| Property | Type | Default | Behavior |
| --- | --- | --- | --- |
| `type` | Artifact type |  | Selects the adapter: `typescript`, `rust`, `prisma`, `markdown`, `swagger`, and every other certified type. |
| `files` | `string[]` |  | Ordered globs relative to `root`; `!` excludes, a later pattern reincludes. |
| `reference` | `IEvidenceReference \| IEvidenceReference[]` |  | One reference or an array of independent obligations. |
| `name` | `string` |  | Labels diagnostics. |
| `severity` | `"error" \| "warning" \| "off"` | root, then `error` | `off` removes the claim; `warning` never fails the check. |
| `disabled` | `boolean` | `false` | Validates the shape but loads nothing. |
| `root` | `string` | config directory | One directory, not a glob. |
| `symbol` | Symbol or nonempty array | family default | Selects claim hosts. |
| `evidenceExcludeCarriers` | `string[]` | all selected files | Narrows exclusions to matching selected files. |

### Reference

| Property | Type | Default | Behavior |
| --- | --- | --- | --- |
| `type` | Artifact type |  | Selects the referenced adapter independently of the claim. |
| `files` / `file` | `string[]` / `string` |  | Globs, or for a Swagger reference one local path or URL. |
| `root` | `string` | config directory | Same rules as claim roots. |
| `symbol` | Symbol or nonempty array | family default | Selects the denominator. |
| `severity` | Evidence severity | claim | `off` removes the reference. |
| `noEvidenceExclude` | `boolean` | `false` | Exclusions fail and provide no coverage. |
| `uniqueEvidence` | `boolean` | `false` | At most one positive host per unit. |
| `singleEvidencePerSymbol` | `boolean` | `false` | Every host cites exactly one unit. |
| `requireReview` | `boolean` | `false` | Every acknowledgement needs a current review. |
| `checklist` | `boolean` | `false` | Markdown only. Every host answers every selected heading. |

### Symbols

| Family | Symbols | Claim default | Reference default |
| --- | --- | --- | --- |
| Programming | `type`, `function`, `property` | all | `type` |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all | all |
| Database | `model`, `column`, `relation` | all | `model` |
| Swagger | `operation` | `operation` | `operation` |

`type` chooses the language before file selection: `.h` follows `c`, `cpp`, or `objc`; `.sql` follows the configured dialect. Roots resolve from the config file; globs are case-sensitive, and a bare `src` selects nothing.

## Tags and targets

```text
@evidence <target> <reason>
@evidenceExclude <target> <reason>
@evidenceReview <target> [#fingerprint] <description>
@evidenceExcludeReview <target> [#fingerprint] <description>
```

Tags live in documentation attached to a public declaration. A target is one whitespace-free token; the prose is required. `{@link Symbol}` is rejected: addresses are file-qualified. `@internal`, `@hidden`, and `@ignore` withdraw a declaration and its descendants.

| Target | Form |
| --- | --- |
| Programming | `<path>#<accessor>`, path from the citing file: `../calculator.ts#add` |
| Instance member | `SomeClass.prototype.member` in TypeScript, JavaScript, Python; owner-direct elsewhere; `Shop.Sale.self.find` for Ruby singletons |
| Literal segment | JSON-string brackets: `Namespace["member.with.dots"]`, ``Shop["Box`1"]``, `Sale["impl Service"].run`, `Widget["-send:to:"]` |
| Markdown | `docs/requirements.md#anchor` from the reference root; `{#anchor}` wins, otherwise the lowercased heading |
| Prisma | `prisma:Sale`, `prisma:Sale.price`, no path |
| SQL and DBML | File-qualified: `schema.sql#app.item.id`; `evidence list` prints relation segments |
| Swagger | `POST:/sales`, uppercase method and exact path |

Markdown tags go in HTML comments under the heading they belong to. Prisma tags go in `///` on models and fields. Swagger tags go in each operation's `description`. Aliases such as barrels add addresses without adding obligations.

| Outcome | Meaning |
| --- | --- |
| `resolved` | Exactly one unit owns the address in this scope. |
| `missing-file`, `missing-member`, `out-of-population` | Nothing selected owns it. |
| `ambiguous` | Several units own it. |
| `hidden` | The unit was withdrawn. |
| `malformed`, `unsupported-host`, `incomplete` | The target or its host cannot be interpreted. |

The resolver never falls back to a project-wide name.

## Languages

Every family can be a claim and a reference and can cite every other. Programming languages and SQL dialects parse through upstream Tree-sitter grammars, Prisma through its own parser, and Swagger as JSON or YAML. Adapters run no compiler, preprocessor, macro, or build; a construct that could change the public surface and cannot be resolved makes analysis incomplete. `evidence languages` prints the shipped registry.

| Type | Files | Public surface | Documentation |
| --- | --- | --- | --- |
| `typescript` | `.ts`, `.cts`, `.mts`, `.tsx` | Static module exports and declaration files | Attached JSDoc |
| `javascript` | `.js`, `.jsx`, `.cjs`, `.mjs` | Static ESM exports and unconditional CommonJS initialization | Attached JSDoc |
| `python` | `.py`, `.pyi` | Module exports with static import and `__all__` resolution | Docstrings or adjacent `#` runs |
| `go` | `.go` | Exported package declarations with receiver ownership | Adjacent comments |
| `rust` | `.rs` | Crate modules, public reexports, nominal impl members | Doc comments or `#[doc]` |
| `java` | `.java` | Source-public declarations, independent of JPMS | Attached Javadoc |
| `csharp` | `.cs` | Source-public declarations and partial identities | `///` or `/** */` XML |
| `c` | `.c`, `.h` | External declarations, tags, typedefs, fields, enumerators per file | Attached Doxygen |
| `cpp` | `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, and other C++ spellings | Namespaces, public members, templates, bounded aliases | Attached Doxygen |
| `ruby` | `.rb`, `.rake`, `.gemspec`, `Gemfile`, `Rakefile` | Classes, modules, public methods, constants, `attr_*`, reopenings | Adjacent `#` runs or RDoc |
| `kotlin` | `.kt` | Public-by-default declarations, companions, resolvable extensions | Adjacent KDoc |
| `swift` | `.swift` | Public/open declarations of one module per root, extensions merged | `///` or `/** */` DocC |
| `php` | `.php` | Namespace declarations and public class members | Adjacent PHPDoc |
| `dart` | `.dart` | Non-underscore declarations across `part` and relative `export` | `///` or `/** */` |
| `scala` | `.scala` | Unrestricted Scala 2 and 3 declarations, named givens, object exports | Adjacent Scaladoc |
| `lua` | `.lua` | Explicit globals and one returned literal module table | `---` LuaDoc or long comments |
| `matlab` | `.m` | `classdef` types, primary functions, public members, `@Class` folders | Percent help |
| `objc` | `.m`, `.h` | Interfaces, protocols, categories, methods, properties, `@public` ivars | Doxygen, `///`, `//!` |
| `zig` | `.zig` | `pub` declarations, exposed container fields, direct aliases | Adjacent `///` |

Every adapter maps its language onto `type`, `function`, and `property`, keeps undocumented public declarations in the population, and ignores tags inside code examples, strings, and ordinary comments.

<details>
<summary><strong>Per-language addresses and boundaries</strong></summary>

- **TypeScript.** `Class.member` static, `Class.prototype.member` instance. Direct, aliased, default, star, and namespace exports resolve through relative paths; type-only exports keep type-space units. Package `exports`, path aliases, ambient modules, global augmentations, and `export =` are incomplete.
- **JavaScript.** `.js` follows the nearest `package.json` `type`. CommonJS accepts unconditional top-level `exports.x = local`, `module.exports.x = local`, and `module.exports = { x, alias: local }`; computed keys and conditional mutation are incomplete.
- **Python.** `Class.member` static, `Class.prototype.member` instance. Static `__all__` or non-underscore declarations; docstrings or a same-indent `#` run before the declaration. Missing local sources and dynamic `__all__` are incomplete.
- **Go.** `Type.Method`; a grouped declaration's comment hosts every member. Build tags, promoted members, and generated declarations are outside the surface.
- **Rust.** Unrestricted `pub` only; `pub use` chains keep one identity. `Sale["impl crate::Service"].run` for trait impls, `Pair[0]` for tuple fields. Cargo features, macros, `#[path]`, and `cfg` alternatives are incomplete.
- **Java.** `Sale.java#Sale.calculate`; same-owner same-name methods form one overload family. `{@code}` and `<pre>` content is inert.
- **C#.** Namespaced `Sale.cs#Shop.Sale.Total`; ``["Box`1"]`` for generics, `["this[]"]` for indexers, `["operator +"]` for operators. Partial declarations share one unit. Conditional compilation is incomplete.
- **C.** `models.h#["struct Sale"]`, or `models.h#Sale` when unambiguous. Include guards are accepted; other preprocessing is incomplete, and includes are not traversed.
- **C++.** ``shop["Box`1"].value``, `constructor`, `destructor`, `["operator +"]`. Class members default private, struct members public. Macros, specialization, inheritance, and modules are incomplete.
- **Ruby.** `Shop.Sale.total`, `Shop.Sale.self.find`, `Shop.Sale["price="]`. Lexical visibility and `module_function` apply; `define_method` and mixins are not evaluated.
- **Kotlin.** `Contract.Companion.run`, `["extension(kotlin.String)"].measure`. Overrides without explicit visibility and `expect`/`actual` are incomplete; `.kts` is rejected.
- **Swift.** One module per root. `Contract.init`, `Contract.subscript`, `Contract.static["+"]`; extensions merge under their owner. Macros and conditional compilation are incomplete.
- **PHP.** `App.Contract.run`, `App.Contract.$value`. Trait composition, `include`, `eval`, and `class_alias` are incomplete.
- **Dart.** `Contract.new`, `Contract["operator +"]`; `part` and relative `export` graphs resolve. Package or SDK export URIs are incomplete.
- **Scala.** `demo.Contract.run`, `demo["object Contract"].apply`; companions never merge. Anonymous givens, `derives`, and macros are incomplete.
- **Lua.** `contract.lua#module.run`; dot and colon methods share one address; no `type` units. Metatables and `require` are incomplete.
- **MATLAB.** `+pkg/@Widget/Widget.m#pkg.Widget.run`; percent help after signatures or before members. `eval`, `dynamicprops`, and missing class folders are incomplete.
- **Objective-C.** `Widget["-send:to:"]`, `["Widget(Extras)"]["-extra"]`, `["protocol(Widget)"]["-run"]`; configure `type: "objc"` explicitly. Non-guard preprocessing and Objective-C++ are incomplete.
- **Zig.** `contract.zig#Contract.run`; quoted identifiers are literal segments. `usingnamespace`, comptime namespaces, and build options are incomplete.

</details>

### Database schema languages

Database adapters share `model`, `column`, and `relation`. Selected files are a declared schema snapshot; migrations, views, and executable statements are incomplete, and no adapter runs SQL.

| Type | Files | Units | Documentation |
| --- | --- | --- | --- |
| `prisma` | `.prisma` | Models and views; parser output decides column versus relation | `///` on models and fields |
| `postgresql` | `.sql` | `schema.table` tables, columns, foreign keys, `ADD COLUMN`, named `ADD CONSTRAINT` | Adjacent comments, `COMMENT ON` |
| `mysql` | `.sql` | `CREATE TABLE` tables, columns, table `FOREIGN KEY` | Adjacent comments, `COMMENT` strings |
| `sqlite` | `.sql`, `.sqlite` | `CREATE TABLE` tables, columns, inline or table foreign keys | Leading `--` runs or one block comment |
| `bigquery` | `.sql`, `.bqsql` | `CREATE TABLE` tables, scalar and `STRUCT` fields, `NOT ENFORCED` foreign keys | Leading comments, `OPTIONS(description)` |
| `sql` | `.sql` | Portable `CREATE TABLE`, inline `REFERENCES`, anonymous `FOREIGN KEY` | Leading `--` runs or block comments |
| `dbml` | `.dbml` | Tables, scalar fields, inline or standalone `Ref` relations | Notes or adjacent standalone comments |

Addresses are file-qualified except Prisma: `schema.sql#app.item.id`, `schema.sql#Store.Child.parent_id`, `schema.dbml#users.id`. Relation segments are dialect-specific (`["constraint owner_fk"]`, `["foreign-key:...]`, `posts["$ref:owner"]`); `evidence list` prints the escaped form.

### Markdown and Swagger

Markdown yields one `file` unit and one per ATX `h1` to `h4`; HTML comments are the only hosts. Swagger 2.0 and OpenAPI 3.x yield `METHOD:/path` operations whose `description` hosts tags; an operation's fingerprint covers its content, effective servers and security, and referenced local components. A reference by URL is fetched on every load.

## CLI

| Command | Purpose | Formats |
| --- | --- | --- |
| `check` | Evaluate every enabled obligation. Default command. | `text`, `json` |
| `list` | List selected units and addressable ancestors with canonical targets. | `text`, `json` |
| `inspect <target>` | Resolve one target in every scope and show its fingerprint and citations. | `text`, `json` |
| `graph` | Export boundaries, nodes, edges, reviews, and diagnostics. | `json`, `mermaid`, `dot` |
| `languages` | Print the certified adapter registry without loading a config. | `text`, `json` |
| `init` | Create a typed starter config without overwriting. |  |

| Option | Behavior |
| --- | --- |
| `-c, --config <path>` | Config path, default `evidence.config.ts`. |
| `--cwd <path>` | Resolve CLI paths from another directory. |
| `--format <value>` | Output format from the table above. |
| `-o, --output <path>` | Write the result to a file and keep stdout empty. |
| `--language`, `--kind` | Filter `list` rows after the full check. |
| `-w, --watch` | Recheck `check` when a dependency changes; NDJSON with `--format json`. |

Exit 0 is a complete analysis without errors, 1 is a complete analysis with violations, 2 is an invalid command or incomplete analysis. JSON reports carry `schemaVersion: 1`.

## Programmatic API

Importing the package starts no parser, loads no configuration, and runs no command.

```ts
import { EvidenceChecker, EvidenceReporter } from "@wrtnlabs/evidence";

const report = await EvidenceChecker.check("evidence.config.ts");
process.stdout.write(EvidenceReporter.render(report, "text"));
process.exitCode = report.exitCode;
```

| Entry point | Purpose |
| --- | --- |
| `EvidenceChecker.check` / `analyze` | The report, or the report with its graph input and result. |
| `new EvidenceQuery(analysis, cwd)` | `list`, `inspect`, and `graph` over one captured analysis. |
| `EvidenceCommand.run(args)` | A finite CLI command with buffered output. |
| `new EvidenceWatcher(configFile, options)` | `watch(callback)` and `close()`; poll, debounce, and parser-retry intervals. |
| `EvidenceConfigLoader.load` / `plan` | The validated config, or the plan with defaults resolved. |
| `new EvidenceParser()` | `parse(input, callback)` over a borrowed Tree-sitter tree with query helpers. |
| `EvidenceLanguageRegistry` | `list()`, `databases()`, `candidates()`, `select(type, file)`. |
| `Evidence*Adapter`, `EvidenceInventory`, `EvidenceGraph`, `EvidenceFingerprint` | Adapter analysis, inventory merging, graph evaluation, fingerprints. |

## Grammar cache

The package ships no grammar WASM. A manifest pins each grammar's commit, URL, SHA-256, and license; the first selected source of a language downloads and verifies it, and every later read verifies it again.

| Platform | Directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\wrtnlabs\evidence\Cache` |
| macOS | `~/Library/Caches/wrtnlabs/evidence` |
| Linux | `$XDG_CACHE_HOME/wrtnlabs/evidence` or `~/.cache/wrtnlabs/evidence` |

`EVIDENCE_CACHE_DIR` overrides the location. A cold cache needs network access once; cache the directory in CI.

## Related

- [Evidence Graph: Make Every SKILL Instruction 100% Enforced](https://ttsc.dev/blog/evidence-graph-make-every-skill-instruction-100-percent-enforced/), the article this README follows.
- [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence), the compiler-integrated variant for TypeScript projects on `ttsc`.
- [Benchmark](https://ttsc.dev/docs/benchmark/evidence) and [raw sessions](https://github.com/samchon/evidence-benchmark-results).
