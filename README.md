# `@samchon/evidence-graph`

`@samchon/evidence-graph` defines an evidence graph for [`@ttsc/lint`](https://ttsc.dev). The graph makes a repository state its grounds explicitly: a Markdown section or selected TypeScript symbol becomes an evidence unit, and every configured population that depends on it must either cite it or record why it does not.

## Before you adopt

This is a `@ttsc/lint` contributor. It requires [`ttsc`](https://ttsc.dev), not stock `tsc` with ESLint. Its Go rules are statically linked into the lint binary on the first build, which can take several minutes with a cold Go cache.

## What a violation looks like

Suppose `docs/orders.md` declares one governed section:

```md
## Create Order {#create-order}
```

If the configured TypeScript reference group contains no acknowledgement, `ttsc check` fails with an actionable project diagnostic:

```text
Missing acknowledgement for 'docs/orders.md#create-order' (Markdown H2 'Create Order' at docs/orders.md:1) in Source 1 ('Order requirements') reference 1 (typescript, symbols: type, function, property). Add '@evidence docs/orders.md#create-order <reason>' to a selected typescript host, or '@evidenceExclude docs/orders.md#create-order <reason>' when this group intentionally does not use it.
```

The repair is explicit. Cite the section from an eligible declaration when it is used, or record a truthful exclusion when that reference population does not use it:

```ts
/** @evidence docs/orders.md#create-order This operation implements the documented creation flow. */
export const createOrder = (): void => {};
```

## Install

```bash
npm i -D @samchon/evidence-graph
```

## Configure the graph

`evidence-graph/index` accepts `IEvidenceGraphConfig`. Its `sources` array declares independent evidence populations. A Markdown source contributes selected sections; a TypeScript source contributes selected exported symbols.

```ts
import type { ITtscLintConfig } from "@ttsc/lint";
import {
  evidenceGraph,
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

Every reference also has a `symbol` selector: it identifies the document or declaration kinds where `@evidence` or `@evidenceExclude` may be written. Omit it to select every supported kind — `"file"`, `"h1"`, `"h2"`, `"h3"`, and `"h4"` for Markdown; `"type"`, `"function"`, and `"property"` for TypeScript.

The separate source and reference types intentionally leave room for additional artifact languages, such as Prisma, without overloading Markdown or TypeScript semantics.

## Markdown sources

A Markdown source selects documents and heading sections from matching files. Omit `symbol` to select every supported kind: `"file"`, `"h1"`, `"h2"`, `"h3"`, and `"h4"`. A symbol array expands one source's evidence units; it does not create separate coverage obligations.

The Markdown discriminator controls parsing, not the filename extension. Every matched regular file is treated as Markdown, so keep binary assets out of Markdown `files` patterns.

| Symbol                | Selects                                         |
| --------------------- | ----------------------------------------------- |
| `"file"`              | The Markdown document itself                    |
| `"h1"` through `"h4"` | Sections at the corresponding ATX heading level |

Heading targets use `<path>#<anchor>`. An explicit `{#anchor}` suffix is the most stable choice; otherwise the rule generates a lowercase slug from the heading text.

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

A heading-level Markdown declaration belongs to its nearest preceding ATX heading. A file-level declaration appears before the first heading. `@evidenceExclude` still requires an eligible host, but moving it between eligible hosts does not change the source unit it acknowledges.

```md
## Pricing implementation

<!-- @evidence docs/sales.md#sale-price This architecture section adopts the documented price. -->

## Editorial exception

<!-- @evidenceExclude docs/sales.md#editorial-terminology This section defines wording only; no artifact implements it. -->
```

## TypeScript sources

A TypeScript source selects exported symbols from matching files. Omit `symbol` to select exported interfaces and type aliases (`"type"`). A symbol array expands one source's selected evidence units; unlike a `reference` array, it does not create separate coverage obligations.

TypeScript globs are evaluated against files in the active `tsconfig` program. A path outside that program is not available to the rule even when its spelling matches the glob.

| Symbol | Selects |
| --- | --- |
| `"type"` | Exported interfaces and type aliases |
| `"function"` | Exported functions, function-valued `const`s, namespace callables, and public instance/static callables or direct function fields of exported classes |
| `"property"` | Property signatures declared directly by exported interfaces and object-shaped type aliases |

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

Function targets follow their public identity. A top-level callable is `createOrder`, a namespace callable is `Orders.create`, a static class callable is `OrderFactory.create`, and an instance callable is `OrderService.prototype.create`. Function-valued public class fields use the same static-versus-instance identity. Constructors and accessors are not function units.

Local declarations exposed through an export list use the public alias: `export { local as publicName }` creates the target `publicName`. A barrel re-export does not create a second unit because its declaration lives in another file.

TypeScript targets do not contain file paths. If selected files expose the same qualified target, the rule reports it as ambiguous instead of choosing one by filesystem order.

## Evidence declarations

Both declaration forms require a target and a non-empty reason:

```text
@evidence <target> <reason>
@evidenceExclude <target> <reason>
```

`@evidence` records that the reference population uses the source unit. `@evidenceExclude` records an intentional non-use. Both count as one explicit acknowledgement for one source unit in one reference group, and a duplicate acknowledgement is an error.

TypeScript declarations live in JSDoc on a selected public contract form. Markdown declarations live in HTML comments: a file-level host is before the first ATX heading, while a heading host is the nearest preceding selected H1–H4 heading. An exclusion may move between eligible hosts without changing which source unit it acknowledges.

## File patterns

Every `files` property takes project-relative glob patterns, not regular expressions.

- `docs/**/*.md` selects every Markdown file below `docs`.
- `packages/*/src/**/*.ts` selects TypeScript source files in every package.
- `specs/v?.md` selects one-character versioned filenames such as `v1.md`.

`*` matches inside one path segment, `**` crosses path segments, and `?` matches one character. A bare directory such as `docs` or `docs/` does not select its descendants; use `docs/**` for the full subtree.

Both `/` and `\` are accepted as separators, but matching remains case-sensitive. Patterns are evaluated from left to right; prefix a pattern with `!` to remove its matches, and use a later positive pattern to include a narrower path again.

## License

MIT
