# `@samchon/evidence-graph`

![Logo](https://raw.githubusercontent.com/samchon/evidence-graph/master/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/evidence-graph/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@samchon/evidence-graph.svg)](https://www.npmjs.com/package/@samchon/evidence-graph) [![NPM Downloads](https://img.shields.io/npm/dm/@samchon/evidence-graph.svg)](https://www.npmjs.com/package/@samchon/evidence-graph) [![Build Status](https://github.com/samchon/evidence-graph/workflows/CI/badge.svg)](https://github.com/samchon/evidence-graph/actions?query=workflow%3ACI) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

The evidence graph for the AI coding era: the guardrail for goal mode.

Your spec is now a compile error.

When Claude Code or Codex works unattended, it can skip a requirement and still report "done." Evidence Graph makes every configured requirement demand an explicit acknowledgement from the code, test, or document that claims to satisfy it.

Every acknowledgement names the exact target and states why it applies. The compiler does not decide whether that reason is true—it forces the agent to commit to a concrete claim. A fabricated reason can no longer hide inside a plausible diff; it sits beside the declaration and evidence it contradicts.

**An agent can still lie. It cannot lie by omission:**

- **Complete**: every configured obligation is accounted for, or the build fails.
- **Tested**: every selected export is claimed by a test, by name.
- **Documented**: decisions and code stay explicitly connected.
- **Honest**: "done" comes with a target and a reason.
- **Integrity**: no citation outlives its target.

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking Renders the combination limit defined by this rule.
 */
export function CouponStackingNotice() {
  return <p>One seller coupon and one platform coupon may be combined.</p>;
}
```

> Without the `@evidence` citation, the next build stops:
>
> ```bash
> $ npx ttsc
> error TS13830: [evidence-graph/index] Missing acknowledgement for
>   'docs/discount.md#coupon-stacking' (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
>   in Claim 1 reference 1 (markdown, symbols: h2, h3).
>
>   Add '@evidence docs/discount.md#coupon-stacking <reason>' to a selected typescript host
>   of this claim, or '@evidenceExclude docs/discount.md#coupon-stacking <reason>' when
>   this claim intentionally does not use it.
>
> Found 1 error.
> ```

## Setup

### Install

```bash
npm install -D typescript ttsc @ttsc/lint
npm install -D @samchon/evidence-graph
```

This is a lint plugin for [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint). It runs on [`ttsc`](https://github.com/samchon/ttsc), not on stock `tsc` with ESLint. If your build does not run `ttsc` yet, adopt that toolchain first.

The first build can take several minutes; it links the rule into the lint binary once, and later builds reuse it.

### Configure

```ts
// lint.config.ts
import type { ITtscLintConfig } from "@ttsc/lint";
import evidenceGraph, { type IEvidenceGraphConfig } from "@samchon/evidence-graph";

const graph: IEvidenceGraphConfig = {
  claims: [
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
  ],
};

export default {
  plugins: {
    "evidence-graph": evidenceGraph,
  },
  rules: {
    "evidence-graph/index": ["error", graph],
  },
} satisfies ITtscLintConfig;
```

Register the plugin in `lint.config.ts` and pass the graph declaration as the option of the `evidence-graph/index` rule. This graph reads as one sentence: the React components under `src` claim to implement the docs, so every H2 and H3 section under `docs` must be cited by a component.

Violations surface in every `ttsc` build, every `--noEmit` check, and every `ttsx` run. They arrive in the same stream as type errors. No separate CI job.

### Compose

```ts
const graph: IEvidenceGraphConfig = {
  claims: [
    // 1. feature documents build on the requirements
    {
      type: "markdown",
      files: ["docs/features/**/*.md"],
      reference: {
        type: "markdown",
        files: ["docs/requirements/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
    // 2. components implement the feature rules
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/features/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
    // 3. tests verify the feature rules and the components
    {
      type: "typescript",
      files: ["test/features/**/*.ts"],
      symbol: "function",
      reference: [
        {
          type: "markdown",
          files: ["docs/features/**/*.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "typescript",
          files: ["src/components/**/*.tsx"],
          symbol: "function",
        },
      ],
    },
  ],
};
```

A graph is one `claims` array, and every claim-reference pair is an independent obligation:

1. Markdown can claim Markdown. The feature documents must acknowledge every requirement they build on.
2. Every feature rule must be cited by a React component; a rule no component mirrors is a compile error naming that rule.
3. A `reference` array is one obligation per element. The tests must verify every feature rule and claim every exported component, never one obligation borrowing the other's citation.

### Symbols

| Kind | `symbol` values | Default |
| --- | --- | --- |
| `"markdown"` | `"file"`, `"h1"`, `"h2"`, `"h3"`, `"h4"` | `["file", "h1", "h2", "h3", "h4"]` |
| `"typescript"` | `"type"`, `"function"`, `"property"` | all three for claims, `"type"` for references |

For TypeScript, `"type"` selects exported interfaces, type aliases, and namespaces. `"function"` selects exported callables. `"property"` selects properties declared by exported type-level symbols and exported `const`, `let`, and `var` declarations at module or namespace scope; a `const` initialized with an arrow or function expression remains a function, while every other variable is a property. Qualified identities preserve their owner: `Orders.Input.id` is a property below `Orders.Input`, while `Orders.state` is namespace data.

A reference's `symbol` selects the evidence units one obligation covers, and an array widens that unit set without creating a second obligation. The units retain their hierarchy: a Markdown file contains its heading outline, a TypeScript interface or object type contains its properties, and a namespace contains every nested public unit. A target acknowledges itself and every selected descendant. An ancestor remains addressable even when its own kind is omitted from the selector, so `symbol: "property"` can still be covered by one `@evidence IShoppingSale ...`.

A claim's `symbol` uses the same selector for the opposite side: it restricts which symbol kinds may host an `@evidence` tag. Namespaces are type hosts, exported data variables are property hosts, and a mixed variable statement can host either of its resident kinds. Omit either selector to accept its documented default.

### File patterns

Every `files` property takes project-relative glob patterns, not regular expressions. `*` matches inside one path segment, `**` crosses segments, and `?` matches one character. A bare directory such as `docs` does not select its descendants; write `docs/**` for the subtree.

- `docs/**/*.md` selects every document below `docs`.
- `backend/src/**/*.ts` selects every backend source file.
- `frontend/src/components/**/*.tsx` selects every React component.
- `test/features/**/*.ts` selects every feature test function.

## Evidence Tags

The tags below are not yours to write. Your agent writes them as it implements, and your job is to review the stated reasons.

### Cite

```ts
/**
 * @evidence docs/sales.md#sale-price This DTO exposes the documented price.
 */
export interface IShoppingSale {
  price: number;
}
```

A TypeScript declaration cites in its JSDoc. The tag is `@evidence target reason`: the target names one evidence unit as the root of an acknowledgement scope, and everything after it is the reason. The reason is required, because a citation that cannot say why it exists is filler.

The target takes four forms:

| Target | Cites |
| --- | --- |
| `docs/sales.md` | A Markdown document and every selected heading below it |
| `docs/sales.md#sale-price` | A heading section and its selected subsection descendants; the heading declares its anchor with the `{#sale-price}` suffix |
| `IShoppingSale` | An exported type, function, or namespace; types and namespaces cover selected descendants |
| `IShoppingSale.price` | One property of an exported type |

```tsx
/**
 * @evidence docs/sales.md#sale-price Renders the price exactly as the pricing rule defines it.
 * @evidence docs/discount.md#discount-display Shows the discounted price next to the original.
 */
export function SalePrice({ sale }: { sale: IShoppingSale }) {
  return <strong>{formatPrice(sale.price)}</strong>;
}
```

A React component cites the same way, and one declaration stacks as many disjoint `@evidence` tags as the rules or scopes it honors. The screen that mirrors a rule names the rule it mirrors. A narrow target documents a narrow implementation; a parent target deliberately accepts responsibility for the complete selected subtree.

```md
## Sale Price {#sale-price}

<!-- @evidence IShoppingSale Sale contract exposes this pricing rule. -->
```

A Markdown document cites in an HTML comment, so rendered prose stays clean. A heading-level citation sits right below its heading. A file-level citation sits at the top of the document. The target here is a TypeScript symbol name; this is the shape a graph uses when documentation owes the citations.

```md
## Editorial Terminology

<!-- @evidenceExclude docs/requirements/coupons.md#coupon-stacking This section defines wording and intentionally does not implement coupon behavior. -->
```

`@evidenceExclude target reason` records that a claim intentionally does not use the target scope. It follows the same hierarchy as `@evidence`, so excluding an H2 also excludes its selected H3/H4 descendants, and excluding a type or namespace excludes its selected children. It must sit on a selected claim host and affects only that claim. Overlapping evidence and exclusion scopes are rejected because they state contradictory intent for the same unit.

In an agent workflow the tags cost nothing extra. The agent writes each citation as it implements. You review the stated reasons instead of reverse-engineering the diff. A misreading also surfaces in that review, because the reason sits beside the exact section it claims to honor.

### Violate

```md
<!-- docs/discount.md -->

## Coupon Stacking {#coupon-stacking}

At most one seller coupon and one platform coupon may combine on a single order.
```

```text
$ npx ttsc check
error TS13830: [evidence-graph/index] Missing acknowledgement for 'docs/discount.md#coupon-stacking' (Markdown H2 'Coupon Stacking' at docs/discount.md:3) in Claim 1 reference 1 (markdown, symbols: h2, h3). Add '@evidence docs/discount.md#coupon-stacking <reason>' to a selected typescript host of this claim, or '@evidenceExclude docs/discount.md#coupon-stacking <reason>' when this claim intentionally does not use it.

Found 1 error.
```

The section exists in the spec, but no React component cites it, so the build fails. The diagnostic names the exact section, the claim that owes it, and both repairs: implement it and cite the section, or exempt it with an `@evidenceExclude` reason a reviewer can veto.

## Concepts

### Why agents need a gate

An agent's completion report is a claim it grades itself. Type errors guard structure and tests guard behavior, but whether the spec was honored has always been checked by a human reading a diff, and in an unattended run that human is gone.

The evidence graph moves that judgment into the build, the one authority an agent already obeys. A skipped section, a missing test, an undocumented contract: each becomes a diagnostic in the same stream as type errors, so the agent fixes spec drift inside the same loop it uses to fix types. The gate costs the workflow nothing, because the agent writes citations as it implements, and what the human reviews shrinks from the whole diff to the stated reasons.

### Coverage and integrity

The graph makes two promises. Coverage says every evidence unit is claimed by everyone who owes it. Integrity says every claim stays true.

Coverage is counted per obligation, never pooled. A backend that honors a rule and a frontend that forgot it is not a 67% project; it is a compile error naming the exact section the screen ignored. This is deliberate: pooled percentages are how partial use by several consumers masquerades as complete use by the project, and how duplicated business logic drifts apart unnoticed. A test citation is stricter than line coverage for the same reason. Line coverage credits code a test merely passes through, while a citation is an explicit claim of responsibility for a named unit.

Integrity is what survives change. A citation dies with its target, so editing a spec section out of existence breaks every artifact that leaned on it, immediately and by name. Between the two promises, every defect this plugin exists for is either a claim that is missing or a claim that stopped being true.

### Documents that can break

Code has always had reference integrity: rename a function and every caller fails. Documents never had it, which is why they rot. Nothing complains when a spec section goes stale, so no one trusts specs, so no one invests in them.

In an evidence graph a document is a set of claims that other artifacts point at by name. Prose gains the same right to break the build that a type has, and the reverse direction closes the loop: a decision that reaches code before anyone writes it down materializes as an exported symbol, which then demands a document. The spec's gaps are found by the compiler instead of by the next confused reader. Completeness guarded in one direction and breakage in the other, documentation stops aging: it is either current or it stops the build. That is what "docs as spec" needs to become real: not discipline, but a linker.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `@samchon/evidence-graph` development.

## References

- [`ttsc`](https://github.com/samchon/ttsc): the `typescript-go` toolchain this plugin runs on.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): the lint engine that links this rule into the compiler.
