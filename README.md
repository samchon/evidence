# `@samchon/evidence-graph`

![Logo](og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/evidence-graph/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@samchon/evidence-graph.svg)](https://www.npmjs.com/package/@samchon/evidence-graph) [![NPM Downloads](https://img.shields.io/npm/dm/@samchon/evidence-graph.svg)](https://www.npmjs.com/package/@samchon/evidence-graph) [![Build Status](https://github.com/samchon/evidence-graph/workflows/CI/badge.svg)](https://github.com/samchon/evidence-graph/actions?query=workflow%3ACI) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

An evidence graph for the AI coding era: the guardrail for goal mode.

Your spec is now a compile error. When Claude Code or Codex runs unattended, the build is the only reviewer left. This plugin puts the spec inside it.

Each `@evidence` citation names its target and states its reason. An agent cannot say "done" without showing where and why. **Silent omission is the one state that cannot exist:**

- **Complete**: every spec section is implemented, or the build fails.
- **Tested**: every export has a test that claims it by name.
- **Documented**: every decision that reaches code reaches the docs, and the docs never fall behind.
- **Honest**: "done" comes with receipts, or not at all.
- **Integrity**: no citation outlives the thing it cites.

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
  sources: [
    {
      type: "markdown",
      files: ["docs/**/*.md"],
      symbol: ["h2", "h3"],
      citedBy: {
        type: "typescript",
        files: ["src/components/**/*.tsx"],
        symbol: "function",
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

Register the plugin in `lint.config.ts` and pass the graph declaration as the option of the `evidence-graph/index` rule. This graph reads as one sentence: every H2 and H3 section under `docs` must be cited by a React component under `src`.

Violations surface in every `ttsc` build, every `--noEmit` check, and every `ttsx` run. They arrive in the same stream as type errors. No separate CI job.

### Compose

```ts
const graph: IEvidenceGraphConfig = {
  sources: [
    // 1. requirements force analysis and architecture documents
    {
      type: "markdown",
      files: ["docs/requirements/**/*.md"],
      symbol: ["h2", "h3"],
      citedBy: [
        { type: "markdown", files: ["docs/analysis/**/*.md"] },
        { type: "markdown", files: ["docs/architecture/**/*.md"] },
      ],
    },
    // 2. feature rules force components and tests
    {
      type: "markdown",
      files: ["docs/features/**/*.md"],
      symbol: ["h2", "h3"],
      citedBy: [
        {
          type: "typescript",
          files: ["src/components/**/*.tsx"],
          symbol: "function",
        },
        {
          type: "typescript",
          files: ["test/features/**/*.ts"],
          symbol: "function",
        },
      ],
    },
    // 3. exported components force tests
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      citedBy: {
        type: "typescript",
        files: ["test/features/**/*.ts"],
        symbol: "function",
      },
    },
  ],
};
```

A graph is one `sources` array, and each entry adds an independent obligation:

1. Markdown can owe Markdown. Every requirement must be acknowledged by the analysis documents and by the architecture documents, each population on its own.
2. A `citedBy` array is one obligation per element. Every feature rule must be mirrored by a React component and verified by a test function, never one borrowing the other's citation.
3. TypeScript can owe TypeScript. Every exported component must be claimed by a test, per component instead of a coverage percentage.

### Symbols

| Kind | `symbol` values | Default |
| --- | --- | --- |
| `"markdown"` | `"file"`, `"h1"`, `"h2"`, `"h3"`, `"h4"` | `["file", "h1", "h2", "h3", "h4"]` |
| `"typescript"` | `"type"`, `"function"`, `"property"` | `"type"` for sources, all three for citers |

For TypeScript, `"type"` selects exported interfaces and type aliases, `"function"` selects exported functions, and `"property"` selects properties declared by exported type-level symbols; a property's identity includes its declaring type. A `symbol` array widens what counts as evidence within one source, and it never creates a second obligation.

A citer group uses the same selector to restrict which symbol kinds may host an `@evidence` tag. Omit `symbol` to allow every supported kind.

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

A TypeScript declaration cites in its JSDoc. The tag is `@evidence target reason`: the target names one evidence unit, and everything after it is the reason. The reason is required, because a citation that cannot say why it exists is filler.

The target takes four forms, one per evidence unit kind:

| Target | Cites |
| --- | --- |
| `docs/sales.md` | A Markdown document |
| `docs/sales.md#sale-price` | A heading section; the heading declares its anchor with the `{#sale-price}` suffix |
| `IShoppingSale` | An exported type or function |
| `IShoppingSale.price` | A property of an exported type |

```tsx
/**
 * @evidence docs/sales.md#sale-price Renders the price exactly as the pricing rule defines it.
 * @evidence docs/discount.md#discount-display Shows the discounted price next to the original.
 */
export function SalePrice({ sale }: { sale: IShoppingSale }) {
  return <strong>{formatPrice(sale.price)}</strong>;
}
```

A React component cites the same way, and one declaration stacks as many `@evidence` tags as the rules it honors. The screen that mirrors a rule names the rule it mirrors. That is how the obligation from `Configure` gets satisfied, one section at a time.

```md
## Sale Price {#sale-price}

<!-- @evidence IShoppingSale Sale contract exposes this pricing rule. -->
```

A Markdown document cites in an HTML comment, so rendered prose stays clean. A heading-level citation sits right below its heading. A file-level citation sits at the top of the document. The target here is a TypeScript symbol name; this is the shape a graph uses when documentation owes the citations.

```md
## Editorial Terminology

<!-- @evidenceExclude This section defines wording only; no artifact implements it. -->
```

`@evidenceExclude` records an intentional non-use. It takes only a reason. Its position does not matter: it exempts its host without becoming a graph node.

In an agent workflow the tags cost nothing extra. The agent writes each citation as it implements. You review the stated reasons instead of reverse-engineering the diff. A misreading also surfaces in that review, because the reason sits beside the exact section it claims to honor.

### Violate

```md
<!-- docs/discount.md -->

## Coupon Stacking {#coupon-stacking}

At most one seller coupon and one platform coupon may combine on a single order.
```

```text
$ npx ttsc check
error TS13830: [evidence-graph/index] Missing acknowledgement for 'docs/discount.md#coupon-stacking' (Markdown H2 'Coupon Stacking' at docs/discount.md:3) in Source 1 citer 1 (typescript, symbols: function). Add '@evidence docs/discount.md#coupon-stacking <reason>' to a selected typescript host, or '@evidenceExclude docs/discount.md#coupon-stacking <reason>' when this group intentionally does not use it.

Found 1 error.
```

The section exists in the spec, but no React component cites it, so the build fails. The diagnostic names the exact section, the citer group that owes it, and both repairs: implement it and cite the section, or exempt it with an `@evidenceExclude` reason a reviewer can veto.

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
