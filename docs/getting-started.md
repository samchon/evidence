# Getting started

This guide creates a two-edge graph: a public implementation cites a Markdown requirement, and a test declaration cites that implementation. The first check fails because neither obligation has been acknowledged. The final check passes after the work and its citations exist.

## Install

Install Evidence with the TypeScript toolchain that evaluates its typed configuration:

```bash
pnpm i -D typescript ttsc @wrtnlabs/evidence
```

`ttsc` supplies `ttsx`. Evidence uses it to typecheck and evaluate `evidence.config.ts`; it does not add another config runtime. The runtime downloads each certified Tree-sitter grammar into a per-user cache on first use and verifies its pinned checksum. Do not install a grammar package or a compiler for each analyzed language.

Create the starter file:

```bash
pnpm exec evidence init
```

`init` writes `evidence.config.ts` and refuses to overwrite an existing file. Replace it with this graph:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  severity: "error",
  claims: [
    {
      name: "pricing implementation",
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
      name: "pricing tests",
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

The `type` value directly selects an implemented adapter. There is no `type: "code"` wrapper or separate `language` field.

## Create the obligations

Create `docs/requirements.md`:

```md
# Pricing requirements

## Exact addition {#exact-addition}

Add prices without intermediate rounding.
```

Create `src/calculator.ts` without a citation:

```ts
export function add(left: number, right: number): number {
  return left + right;
}
```

Create `test/calculator.test.ts` without a citation:

```ts
import { add } from "../src/calculator";

export function test_add(): void {
  if (add(1, 2) !== 3) throw new Error("Unexpected sum.");
}
```

Run the complete graph:

```bash
pnpm exec evidence check
```

The requirement is selected but uncited, and the implementation function is selected but uncited by a test host. The command exits 1 after complete analysis. Treat those findings as work items: implement the behavior and test first, then state why each declaration supplies its target.

## Add the evidence edges

Attach the requirement citation to the public implementation:

```ts
/** @evidence docs/requirements.md#exact-addition Implements exact addition without intermediate rounding. */
export function add(left: number, right: number): number {
  return left + right;
}
```

Programming files resolve Markdown targets from the Markdown reference root, which defaults to the directory containing `evidence.config.ts`. The target therefore uses `docs/requirements.md` even though the citing file is under `src`.

Import and cite the implementation from the test declaration:

```ts
import { add } from "../src/calculator";

/** @evidence ../src/calculator.ts#add Verifies exact addition through the public function. */
export function test_add(): void {
  if (add(1, 2) !== 3) throw new Error("Unexpected sum.");
}
```

Programming target paths resolve from the citing file. The test therefore uses `../src/calculator.ts#add`. Evidence resolves the file-qualified public address from selected source; the TypeScript import helps the test and does not resolve the Evidence target.

Run the checker again:

```bash
pnpm exec evidence check
```

The report now shows two covered units, no missing units, and exit code 0. Evidence has checked the two structural edges. It has not run `test_add` or proved that either reason is true.

## Discover an address

List configured targets when a symbol spelling is uncertain:

```bash
pnpm exec evidence list --language typescript --kind function
```

Inspect one target and its graph state:

```bash
pnpm exec evidence inspect 'src/calculator.ts#add'
```

`list` reports canonical targets and public aliases. `inspect` uses the same inventories and resolver as `check`, and preserves the exact target outcome described in [tags and targets](tags-and-targets.md) instead of guessing.

## Add CI

Run the same complete command in CI after dependency installation:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm exec evidence check
```

Do not mask its status with a shell fallback. Exit 1 means complete analysis found Evidence violations. Exit 2 means configuration, discovery, parsing, or another required analysis step was incomplete and must be repaired before the graph can be trusted.

Continue with the [configuration reference](configuration.md), [tags and targets](tags-and-targets.md), and [CLI reference](cli.md).
