# `@samchon/evidence-graph`

`@samchon/evidence-graph` defines an evidence graph for [`@ttsc/lint`](https://ttsc.dev). The graph makes a repository state its grounds explicitly: a Markdown section or selected TypeScript symbol becomes an evidence unit, and every configured population that depends on it must either cite it or record why it does not.

## Before you adopt

This is a `@ttsc/lint` contributor. It requires [`ttsc`](https://ttsc.dev), not stock `tsc` with ESLint. Its Go rules are statically linked into the lint binary on the first build, which can take several minutes with a cold Go cache.

## Install

```bash
npm i -D @samchon/evidence-graph
```

## Configure the graph

`evidence-graph/index` accepts `IEvidenceGraphConfig`. Its `sources` array declares independent evidence populations. A Markdown source contributes selected sections; a TypeScript source contributes selected exported symbols.

```ts
import type { ITtscLintConfig } from "@ttsc/lint";
import evidenceGraph, {
  type IEvidenceGraphConfig,
} from "@samchon/evidence-graph";

const graph: IEvidenceGraphConfig = {
  sources: [
    {
      type: "markdown",
      name: "Service specifications",
      files: ["docs/**/*.md"],
      symbol: ["file", "h1", "h2", "h3", "h4"],
      reference: [
        {
          type: "typescript",
          files: ["packages/*/src/**/*.ts"],
        },
        {
          type: "markdown",
          files: ["docs/architecture/**/*.md"],
        },
      ],
    },
    {
      type: "typescript",
      name: "Public contracts",
      files: ["packages/*/src/**/*.ts"],
      symbol: ["type", "function"],
      reference: {
        type: "markdown",
        files: ["docs/**/*.md"],
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

## Sources and references

Every source owns its own coverage. Two source entries that select the same files are still two separate obligations; they are never merged into a single percentage.

`reference` is either one reference group or an array of groups. A single group must account for every evidence unit in its source. Each element in an array must independently account for every unit: two 50% groups do not form one 100% group.

References are themselves discriminated by `type`.

| Reference type | Citing artifact | `files` selects |
| --- | --- | --- |
| `"markdown"` | Markdown sections | Markdown files that must acknowledge the source |
| `"typescript"` | TypeScript declarations | TypeScript files that must acknowledge the source |

Every reference also has a `symbol` selector: it identifies the document or declaration kinds where `@evidence` may be written. Omit it to select every supported kind — `"file"`, `"h1"`, `"h2"`, `"h3"`, and `"h4"` for Markdown; `"type"`, `"function"`, and `"property"` for TypeScript.

The separate source and reference types intentionally leave room for additional artifact languages, such as Prisma, without overloading Markdown or TypeScript semantics.

## Markdown sources

A Markdown source selects documents and heading sections from matching files. Omit `symbol` to select every supported kind: `"file"`, `"h1"`, `"h2"`, `"h3"`, and `"h4"`. A symbol array expands one source's evidence units; it does not create separate coverage obligations.

| Symbol                | Selects                                         |
| --------------------- | ----------------------------------------------- |
| `"file"`              | The Markdown document itself                    |
| `"h1"` through `"h4"` | Sections at the corresponding ATX heading level |

```ts
{
  type: "markdown",
  files: ["docs/**/*.md"],
  symbol: ["h2", "h3"],
  reference: {
    type: "typescript",
    files: ["packages/*/src/**/*.ts"],
  },
}
```

A heading-level Markdown citation belongs immediately below the heading it supports. A file-level citation belongs at the document level. `@evidenceExclude` does not identify a graph node, so its location is irrelevant.

```md
## Sale Price {#sale-price}

<!-- @evidence IShoppingSale Sale contract exposes this pricing rule. -->

## Editorial Terminology

<!-- @evidenceExclude This section defines wording only; no artifact implements it. -->
```

## TypeScript sources

A TypeScript source selects exported symbols from matching files. Omit `symbol` to select exported interfaces and type aliases (`"type"`). A symbol array expands one source's selected evidence units; unlike a `reference` array, it does not create separate coverage obligations.

| Symbol       | Selects                                            |
| ------------ | -------------------------------------------------- |
| `"type"`     | Exported interfaces and type aliases               |
| `"function"` | Exported function declarations                     |
| `"property"` | Properties declared by exported type-level symbols |

```ts
{
  type: "typescript",
  files: ["packages/*/src/**/*.ts"],
  symbol: ["type", "property"],
  reference: {
    type: "markdown",
    files: ["docs/**/*.md"],
  },
}
```

The TypeScript declaration carries its citation in JSDoc, keeping the reason attached to the precise public contract instead of to the surrounding file.

```ts
/** @evidence docs/sales.md#sale-price This DTO exposes the documented price. */
export interface IShoppingSale {
  price: number;
}
```

## File patterns

Every `files` property takes project-relative glob patterns, not regular expressions.

- `docs/**/*.md` selects every Markdown file below `docs`.
- `packages/*/src/**/*.ts` selects TypeScript source files in every package.
- `specs/v?.md` selects one-character versioned filenames such as `v1.md`.

`*` matches inside one path segment, `**` crosses path segments, and `?` matches one character. A bare directory such as `docs` or `docs/` does not select its descendants; use `docs/**` for the full subtree.

## License

MIT
