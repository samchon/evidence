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

| Rule | Scope | Does |
| --- | --- | --- |
| `evidence/index` | project | Builds the document and symbol index everything else resolves against |
| `evidence/reference` | file | Every `@evidence` tag carries a reason and resolves |

`evidence/index` is project-scoped, so it must go in a config entry with no `files` key.

**Turning `evidence/index` off does not relax enforcement — it silences everything.** Without an index there is nothing to resolve against, and a rule that reported anyway would be blaming authors for its own blindness. This is deliberate: a rule that fires before its evidence is authorable pushes people toward false citations, and a false citation outlives the moment that produced it.

`node_modules`, `.git`, `lib`, `dist`, and `coverage` are never indexed. They hold other people's markdown, and a citation resolving against a dependency's README proves nothing.

## Prior art

[`autobe-mcp`](https://github.com/wrtnlabs/autobe-mcp) enforces this idea for LLM-generated backends, with a graph hardcoded to its domain and evidence carried in typed JSON fields. It is where the good ideas here come from — coverage and integrity being different questions, silence before authorability, identity decoupled from prose.

Two things differ. The graph here is yours to declare rather than ours to hardcode. And evidence rides a JSDoc tag rather than a schema field, because the subject is arbitrary TypeScript source, where a comment is the only attachment point every declaration has.

`autobe-mcp` pays for its design by writing the coverage formula twice — once in TypeScript for write-time validation, once in Go for build-time lint — with comments in both insisting they must never diverge. One lint layer removes that duplication entirely.

## License

MIT
