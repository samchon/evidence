# `@samchon/evidence`

Evidence-graph lint contributor for [`@ttsc/lint`](https://ttsc.dev).

Cite the grounds for a declaration with a JSDoc `@evidence` tag. A citation that points at nothing, or carries no reason, fails the build.

```ts
/**
 * @evidence docs/spec.md#pricing Sale price derives from the campaign rate.
 */
export interface IShoppingSale {
  price: number;
}

/**
 * @evidence docs/spec.md#discounts Discount policy is defined there.
 */
export interface IShoppingDiscount {
  rate: number;
}
```

If `docs/spec.md` declares `## Pricing` but no discounts section, the second one is a compile error:

```
src/sale.ts:9:4 - error TS16046: [evidence/reference] Evidence target 'docs/spec.md#discounts' refers to a section that docs/spec.md does not declare. It declares: pricing, shopping-spec. An anchor is derived from the heading text unless the heading declares one explicitly with '{#id}'.

9  * @evidence docs/spec.md#discounts Discount policy is defined there.
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in src/sale.ts:9
```

Not a warning in a report nobody reads. `@ttsc/lint` runs in the check stage and the exit code sums lint and type diagnostics, so an unproven claim breaks the build exactly like a type error does — same output stream, same error code shape, same non-zero exit.

## Before you adopt

**This requires [`ttsc`](https://ttsc.dev), not stock `tsc` with ESLint.** `ttsc` is a TypeScript-Go compiler that runs lint rules inside the same Program as the type-check pass. If your build is `tsc` + `eslint`, adopting this means changing your compiler, which is a real cost and worth knowing on line 10 rather than line 200.

The first build after adding this plugin statically links its Go into the lint binary and **can take several minutes on a cold Go cache**. It is cached per cache key; later builds are unaffected.

## Install

```bash
npm i -D @samchon/evidence
```

`lint.config.ts`:

```ts
import type { ITtscLintConfig } from "@ttsc/lint";
import evidence from "@samchon/evidence";

export default {
  plugins: { evidence },
  rules: {
    "evidence/index": ["error", { documents: ["docs/**/*.md"] }],
    "evidence/reference": "error",
  },
} satisfies ITtscLintConfig;
```

## Editor completion

With `ttsc` and `@ttsc/lint` 0.20.0 or newer, `evidence/index` publishes completion hints through the official [ttsc VS Code path](https://ttsc.dev/docs/lint/editor):

| Typed                        | Offered                                       |
| ---------------------------- | --------------------------------------------- |
| `@evi`                       | `evidence`                                    |
| `@evidence docs/sp`          | `docs/spec.md`                                |
| `@evidence docs/spec.md#pri` | anchors from that document, such as `pricing` |

The corpus follows the index rule's `documents` scope. Explicit `{#id}` anchors rank before derived anchors because an explicit identity survives a heading edit.

## The tag

```
@evidence <target> <reason>
```

The first token is the target; the rest is prose. This is the ordinary JSDoc shape — the same one `@param name description` uses — so nothing new has to be learned.

A target is one of two things:

| Target                  | Means                                         |
| ----------------------- | --------------------------------------------- |
| `docs/spec.md#pricing`  | A section of a markdown document              |
| `docs/spec.md`          | A whole markdown document                     |
| `IShoppingSale.IUpdate` | A TypeScript declaration, namespaces included |

A target containing `#` or `/`, or ending in `.md`, is read as a document; anything else is read as a symbol. Every diagnostic says which way it read your target, so a surprise is visible rather than baffling.

**The reason is not decoration.** A bare pointer cannot be reviewed: nothing in it says what the citation claims, so a reader cannot tell whether it holds. A tag without a reason is an error.

## Anchors

An anchor is derived from the heading text, matching GitHub's slug — so a fragment copied from the rendered page resolves:

```md
## Pricing        ->  docs/spec.md#pricing
## 가격 정책       ->  docs/spec.md#가격-정책
```

A heading may declare its anchor explicitly instead:

```md
## Pricing And Discounts {#pricing}
```

Prefer the explicit form for anything widely cited. A derived anchor is hostage to its prose: rename the heading and every citation to it breaks. An explicit anchor lets you rewrite the heading freely, which is the difference between a graph that helps and a graph that taxes every editorial fix.

Two headings that resolve to the same anchor are an error rather than a silent tiebreak. GitHub disambiguates by suffixing `-1`, but copying that would make a citation's meaning depend on heading _order_ — reorder the document and the citation quietly points somewhere else.

## Rules

The graph is interrogated from three sides. They look similar and are not.

| Rule | Scope | Asks |
| --- | --- | --- |
| `evidence/index` | project | — builds the index everything else resolves against |
| `evidence/reference` | file | Does this citation point at something real? |
| `evidence/require` | file | Does this declaration assert something while citing nothing? |
| `evidence/coverage` | project | Does anything claim to implement this section? |

Each is blind to the others' question, which is why all three exist. Coverage counts sections with no citation, so it can never see a citation with no section — that is `evidence/reference`'s job. Integrity never sees a declaration that simply has no tag — that is `evidence/require`'s. And a citation can pass one while failing another: one that resolves but points outside a policy's required documents satisfies integrity and fails obligation.

Enabling one does not cover the others. Pick the questions you actually want answered.

`evidence/index` and `evidence/coverage` are project-scoped, so they must go in a config entry with no `files` key.

## Requiring citations by folder

```ts
"evidence/require": ["error", {
  policies: [
    { files: ["src/providers/**"], targets: ["docs/analysis/**/*.md"] },
  ],
}],
```

```
src/providers/order.ts:9:18 - error TS15888: [evidence/require] 'IUngrounded' is not grounded. Declarations under src/providers/** must cite a section under docs/analysis/**/*.md, as in '@evidence docs/spec.md#pricing <why this declaration follows from that section>'.

src/providers/order.ts:19:18 - error TS15888: [evidence/require] 'IWrongTarget' cites 'docs/design/notes.md#scratch', and none of them is a section under docs/analysis/**/*.md. A citation outside the required documents does not discharge this obligation, even when it resolves.
```

Only exported, top-level `interface`, `type`, `class`, `function`, and `enum` declarations are obliged by default; `variable` and `namespace` are opt-in through `kinds`. Demanding grounds for every exported constant trains authors to write filler, which is worse than demanding nothing.

Glob patterns select an entry and everything below it, so `src/providers`, `src/providers/`, and `src/providers/**` all govern the same subtree. The same directory shorthand applies to index documents, required targets, and coverage documents.

Only **document sections** discharge an obligation. A symbol citation is still checked for integrity, but it cannot ground a declaration: a symbol both cites and is cited, so two declarations naming each other would satisfy every obligation between them while proving nothing. A section is terminal, and that is what makes it grounds.

Put every policy in one entry. Splitting them across config entries does not accumulate and does not warn — a rule setting has no `files` key, a config file is one object rather than an array, and `extends` takes a single string, so one config file contributes at most one rules entry.

## Finding what nothing implements

```ts
"evidence/coverage": ["error", { documents: ["docs/analysis/**/*.md"] }],
```

```
error TS10735: [evidence/coverage] Nothing cites 2 declared sections: docs/spec.md#refunds, docs/spec.md#shipping. Either cite each from the declaration it grounds with '@evidence <section> <reason>', or state why it needs none by putting '<!-- evidence-exempt: <reason> -->' under its heading.
```

No file, no line — a section has no TypeScript node to point at, and pretending otherwise would mean nominating some arbitrary file to blame.

`documents` is required and must be non-empty. Coverage cannot inherit the index rule's scope because project rules cannot read one another's options; guessing every markdown file would instead demand citations for unrelated READMEs and guides.

A section that genuinely needs no citation says so in the document, under its heading:

```md
## Naming Conventions

<!-- evidence-exempt: describes a convention, not behavior anything implements -->
```

The reason is mandatory. A marker with a blank reason is an error rather than an exemption — a blank reason is not a reason, and accepting one turns a decision somebody made into a hole nobody has to defend. It is also reported rather than ignored, because whoever wrote it believes they addressed the finding.

The exemption lives in the document because that is where the uncited thing lives, and it is an HTML comment so it stays invisible in every renderer while staying reviewable in the source. A lint disable comment would be cheaper and wrong on every count: it sits in TypeScript while the uncited thing is a section, it suppresses every future diagnostic on that node rather than this one question, it demands no reason, and nothing could then answer "how many exemptions does this repository carry".

When a whole document is reference material, narrow `documents` instead of exempting its sections one at a time.

### Adoption is authorship, not configuration

Turning a broad policy on over an existing codebase produces hundreds of errors at once. The cheapest way to clear them is to write a plausible citation on each — and that yields a graph that is fully covered, largely false, and permanently indistinguishable from a real one. No mechanism here can tell the difference afterward, which is exactly why none is offered: there is no baseline file, no autofix that inserts `@evidence`, and no minimum reason length. Each would industrialize the lie.

Start from a folder small enough to cite honestly, and widen the glob deliberately. The glob is the ratchet — it is diffable, reviewable, and states which folders are under discipline.

**Turning `evidence/index` off does not relax enforcement — it silences everything.** Without an index there is nothing to resolve against, and a rule that reported anyway would be blaming authors for its own blindness. This is deliberate: a rule that fires before its evidence is authorable pushes people toward false citations, and a false citation outlives the moment that produced it.

`node_modules`, `.git`, `lib`, `dist`, and `coverage` are never indexed. They hold other people's markdown, and a citation resolving against a dependency's README proves nothing.

## Prior art

[`autobe-mcp`](https://github.com/wrtnlabs/autobe-mcp) enforces this idea for LLM-generated backends, with a graph hardcoded to its domain and evidence carried in typed JSON fields. It is where the good ideas here come from — coverage and integrity being different questions, silence before authorability, identity decoupled from prose.

Two things differ. The graph here is yours to declare rather than ours to hardcode. And evidence rides a JSDoc tag rather than a schema field, because the subject is arbitrary TypeScript source, where a comment is the only attachment point every declaration has.

`autobe-mcp` pays for its design by writing the coverage formula twice — once in TypeScript for write-time validation, once in Go for build-time lint — with comments in both insisting they must never diverge. One lint layer removes that duplication entirely.

## License

MIT
