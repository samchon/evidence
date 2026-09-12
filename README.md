# @samchon/evidence

An Evidence Graph connects specifications, engineering principles, public code contracts, and tests through explicit citations. `@samchon/evidence` checks that every selected requirement has evidence or a permitted exclusion, and that every citation names a valid target and explains its relationship.

The configuration and graph semantics follow [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence), with programming-language declarations selected from files through Tree-sitter.

## Installation

```bash
pnpm i -D typescript ttsc @samchon/evidence
```

`typescript` and `ttsc` are required peers supplied by the consumer. The `ttsx` executable comes from `ttsc` and evaluates `evidence.config.ts`.

## Configuration

Create `evidence.config.ts` at the project root:

```ts
import type { IEvidenceConfig } from "@samchon/evidence";

const config: IEvidenceConfig = {
  severity: "error",
  claims: [
    {
      type: "typescript",
      files: ["src/**"],
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
    {
      type: "typescript",
      files: ["test/**"],
      symbol: "function",
      reference: {
        type: "typescript",
        files: ["src/**"],
        symbol: "function",
        noEvidenceExclude: true,
      },
    },
  ],
};

export default config;
```

A **claim** selects the files and declarations that must cite evidence. Its **reference** selects what must be covered. Each claim and each element of its reference array has an independent coverage obligation; partial coverage from separate obligations is never pooled.

Use `type` to select the source language, such as `"typescript"`, `"cpp"`, or `"rust"`, and `files` to select its files with globs. `EvidenceProgrammingType` defines programming-language identifiers; `EvidenceDatabaseType` defines database schema languages such as `"prisma"`, `"sql"`, and `"dbml"`. File names distinguish syntax variants such as TSX. No separate `language` setting or TypeScript compiler Program is required.

Globs resolve from the directory containing `evidence.config.ts`, or from the population's `root`. Patterns are applied in order: `!` excludes matches, and a later positive pattern can include them again. Use `src/**` to select a directory's contents.

Run the checker from the project root:

```bash
pnpm exec evidence
```

For programmatic loading, import `EvidenceConfigLoader` from `@samchon/evidence` and call `await EvidenceConfigLoader.load("evidence.config.ts")`. It returns an `IEvidenceConfig` and defaults to `evidence.config.ts` in the current working directory. Supported extensions are `.ts`, `.cts`, and `.mts`.

The loader checks the configuration and its imports through the consumer's `ttsx`, then applies `typia.assert<IEvidenceConfig>` to the default export. Compiler and runtime failures reject the promise, and evaluator logs go to stderr. Returned settings retain their authored paths and optional values.

For direct local source access, `EvidenceSourceLoader.glob(configFile, { root, files })` loads an enabled population, and `EvidenceSourceLoader.file(configFile, file, root)` loads one exact local path. Relative roots resolve from the configuration file's directory; file globs run left to right, including exclusions and later reinclusions. A bare directory selects no children; use `directory/**`.

Source snapshots retain UTF-8 contents, byte digests, physical file identities, every selected logical address, and filesystem dependencies for detecting changes. Directory links and hard links share physical files without losing their addresses. Always inspect `complete` and `diagnostics`: a healthy empty selection is complete, while an inaccessible root, cyclic link, or unreadable file makes the snapshot incomplete. Invalid root or glob syntax rejects the promise. Discovery retains all selected formats for adapter processing; filesystem completeness alone does not establish parser support or evidence coverage.

`EvidenceMarkdownAdapter.analyze(snapshot)` turns a Markdown snapshot into file and ATX H1-H4 units, public file/anchor addresses, section ownership, HTML-comment hosts, acknowledgements, and reviews. It retains discovery failures and reports whitespace paths, unresolved heading anchors, annotations below H5/H6, and tag lines rendered as prose. Fenced, indented, HTML `<pre>`, and MDX template examples do not produce annotations.

For direct syntax analysis, use `EvidenceParser.parse(input, callback)`. The callback receives a borrowed tree and query helpers; copy extracted values into ordinary data before it returns:

```ts
import { EvidenceParser } from "@samchon/evidence";

const parser = new EvidenceParser();
try {
  const names = await parser.parse(
    {
      type: "typescript",
      file: "calculator.ts",
      content: "export function add(a: number, b: number) { return a + b; }",
    },
    (session) =>
      session
        .captures("(function_declaration name: (identifier) @name)")
        .map((capture) => capture.node.text),
  );
  console.log(names);
} finally {
  await parser.close();
}
```

The runtime reads checksum-verified packaged grammars lazily and performs no grammar downloads or native compilation. Each parse owns its parser, tree, and query cache. `concurrency` limits live sessions and defaults to four; `close()` waits for accepted callbacks and prevents new requests. A callback must not await another parse or close on the same runtime. Syntax errors, missing tokens, incompatible queries, and truncated query results throw `EvidenceParserError` with a stable `code` instead of returning incomplete captures. `session.range(node)` produces a half-open span with zero-based UTF-16 offsets and one-based lines and UTF-16 columns in the original source string.

`EvidenceLanguageRegistry.list()` reports syntax variants separately from certified Evidence adapter capabilities. TypeScript and JavaScript entries include adapter metadata; grammar-only entries omit it. `select(type, file)` uses the configured language and case-sensitive logical file name, so `.h` follows `c` or `cpp`, and `.tsx` selects the TSX grammar within TypeScript. `parser.grammars()` reports pinned asset provenance without loading WASM; `parser.state()` exposes the instance's loaded grammar IDs and active/queued session counts. Grammar metadata alone does not establish public export resolution or graph coverage.

For adapter development, `IEvidenceAdapter.analyze(snapshot)` returns an ordinary `IEvidenceInventory`. `new EvidenceInventory(inventories)` combines adapter-established identities, checks declaration ownership and original source coordinates, and reconciles withdrawal across merged declarations. `select(ids)` returns an independent population with its structural ancestors and eligible hosts; `resolve({ file, segments }, ids)` looks up an exact public address inside that scope. Check `complete` and `diagnostics` before using a population. Reviews have a separate collection and never supply acknowledgements.

`EvidenceDocumentation.read()` maps a classified comment into its original source, and `EvidenceTagParser.parse()` reads acknowledgements, exclusions, reviews, and withdrawal markers from that mapped text. Adapters establish comment identity and attachment before invoking these helpers. `EvidenceAccessor.parse()` and `format()` preserve literal member segments such as `SomeClass["field.name"]`. See the [adapter inventory guide](https://github.com/samchon/evidence/blob/master/docs/development/adapter-inventories.md) for ownership, completeness, and documentation contracts.

## Artifacts and symbol selectors

| Artifact | Claim | Reference | Symbol selectors | Default claim / reference |
| --- | --- | --- | --- | --- |
| Programming | Yes | Yes | `type`, `function`, `property` | All / `type` |
| Markdown | Yes | Yes | `file`, `h1`, `h2`, `h3`, `h4` | All / all |
| Database schemas | Yes | Yes | `model`, `column`, `relation` | All / `model` |
| Swagger / OpenAPI | Yes | Yes | `operation` | Every operation / every operation |

Every artifact family can cite every other family, including its own. Markdown can cite programming declarations or Swagger operations, and Swagger operations can cite Markdown, programming declarations, database schemas, or other operations.

A `symbol` accepts one selector or a nonempty array. Programming `type` symbols include classes, interfaces, type aliases, and namespaces. Database `model` symbols describe record structures, `column` symbols describe data fields, and `relation` symbols describe connections between models. A foreign-key value is a column; the declaration describing its connection is a relation.

All database schema languages use `IEvidenceDatabaseClaim` and `IEvidenceDatabaseReference`. Their `type` distinguishes Prisma, SQL dialects, and DBML. Select the source schema language rather than the database server: MongoDB models written in Prisma use `type: "prisma"`.

Prisma files selected for one population are parsed together with `@prisma/prisma-schema-wasm`, which ships with this package. Evidence first uses a parser version visible from the project root and falls back to its pinned copy, so consumers do not install a separate Prisma parser. Parser output decides whether a member is a column or relation; the source scanner only supplies locations and documentation attachment. Views are model units, while enums, composite types, indexes, generators, and datasources do not form units.

`EvidenceJavaScriptAdapter` parses `.js`, `.jsx`, `.mjs`, and `.cjs` with the packaged JavaScript grammar. `.mjs` always uses ESM and `.cjs` always uses CommonJS. A `.js` or `.jsx` file follows the nearest `package.json` `type`; missing metadata defaults to CommonJS. Checked package paths become watch dependencies, and unreadable, malformed, unsupported, or conflicting metadata leaves the inventory incomplete.

Exported classes are `type` units. Functions, generators, function-valued `const` declarations, methods, and function-valued class fields are `function` units; other exported values and public fields are `property` units. Static members use `Class.member`, while instance members use `Class.prototype.member`. Constructors, accessors, private fields, and computed member names do not form units. Anonymous default classes, functions, function expressions, and values use the public `default` address.

JavaScript ESM follows direct exports, aliases, defaults, imported bindings that are re-exported, named and star reexports, namespace exports, explicit shadowing, ambiguity, and finite cycles through relative snapshot files. CommonJS accepts unconditional top-level `exports.name = local`, `module.exports.name = local`, `module.exports = local`, and `module.exports = { name, alias: local }`. Replacing `module.exports` clears earlier names and detaches `exports`; `exports = module.exports` reconnects it. Computed keys, conditional mutation, dynamic replacement, inline values, shadowed bindings, and escaped aliases make analysis incomplete.

Only attached JSDoc carries JavaScript evidence, exclusions, or reviews. JSX text, strings, templates, regular expressions, line comments, ordinary block comments, and detached JSDoc do not create evidence edges. Exported declarations without JSDoc remain policy hosts.

Markdown preserves its document outline, and Prisma preserves its schema structure. Swagger claims select local JSON/YAML documents with `files` globs. Swagger references use `file` for an exact local JSON/YAML path or an HTTP(S) URL, with an optional `root` for local paths.

Markdown section anchors prefer a valid trailing `{#anchor}`. Otherwise, the adapter lowercases the heading, retains Unicode letters, numbers, and underscores, removes punctuation, and collapses whitespace or hyphens. Repeated anchors remain distinct sections and make the shared target ambiguous until the author supplies unique anchors.

## Evidence declarations

Write `@evidence <target> <reason>` in a declaration's documentation comment. Code targets name a file relative to the citing file, followed by `#` and a public symbol:

```ts
/** @evidence ../calculator.ts#add Verifies the addition contract. */
/** @evidence ../SomeClass.ts#SomeClass.member Supplies the public static member. */
/** @evidence ../SomeClass.ts#SomeClass Represents the class contract. */
/** @evidence ../SomeNamespace.ts#SomeNamespace.property Supplies the namespace value. */
```

TypeScript instance members use `SomeClass.prototype.member`. File-qualified targets identify declarations without compiler import-scoped `{@link Symbol}` lookup.

| Target                | Example                            |
| --------------------- | ---------------------------------- |
| Code symbol           | `../calculator.ts#add`             |
| Markdown document     | `docs/requirements.md`             |
| Markdown heading      | `docs/requirements.md#pricing`     |
| Prisma model or field | `prisma:Sale`, `prisma:Sale.price` |
| Swagger operation     | `POST:/sales`                      |

Markdown paths resolve from the reference population's root. Backslashes are accepted as portable separators and leading `./` is ignored, while case and percent signs remain literal. The text after `#` is one exact Markdown anchor, so `docs/spec.md#price.v2` does not mean nested members. Markdown claims place tags in HTML comments. Prisma claims use `///` or block documentation attached to models and members; an unattached top-level `///` run may carry exclusions only.

Swagger claims read tags from each operation's `description`. For example, an operation can cite a Markdown requirement:

```yaml
paths:
  /sales:
    post:
      description: |
        Creates a sale.
        @evidence docs/requirements.md#sales Exposes the required sale creation operation.
```

Fenced examples and other JSON/YAML string fields do not host tags. Operations without descriptions remain selected hosts for coverage policies.

Swagger 2.0 and supported OpenAPI 3.x JSON/YAML documents are normalized into standard and additional operations under `paths`. Paths keep their exact case, spelling, and trailing slash; methods become uppercase. Components, path items, webhooks, and the whole document do not become aggregate units. Each operation fingerprint includes its normalized content and recursively referenced local components. Recursive references terminate, while unresolved or external schema references remain unfetched.

Swagger references load one exact local path or explicit HTTP(S) URL. Remote documents are fetched for every load with a 30-second timeout and a 16 MiB response limit; retained paths and diagnostics omit URL credentials and query values. Any file, fetch, UTF-8, parse, version, normalization, duplicate-operation, or target-shape failure leaves the inventory incomplete.

A citation to a containing type, namespace, document section, or model covers its selected descendants. `@evidenceExclude <target> <reason>` records why a selected obligation does not apply, subject to the reference's policy. The checker validates the declaration and its target; reviewers judge whether the explanation is true.

## Reviews

Set `requireReview: true` on a reference when every accepted acknowledgement must carry a current review. Pair `@evidence` with `@evidenceReview`, and pair `@evidenceExclude` with `@evidenceExcludeReview`, on the same semantic claim host and resolved target:

```ts
/**
 * @evidence docs/requirements.md#pricing Implements the pricing rule.
 * @evidenceReview docs/requirements.md#pricing #4c0e8e1 Read the rule and exercised its boundary cases.
 */
export function calculatePrice(): number {
  return 0;
}
```

The seven-character fingerprint represents the cited identity and its full structural subtree. It is independent of the reference selector and public alias used to reach that identity. Evidence annotations, checkout line endings, and trailing whitespace do not change it; semantic content, descendants, declaring identity, and withdrawal decisions do.

`EvidenceFingerprint.inspect(inventory, unitId)` returns the fingerprint version, the unit's content digest, the full scope digest, and the presented seven-character value. It refuses incomplete inventories. Source snapshot digests remain separate cache identities.

Fingerprint version changes are review migrations. Inspect the new value, review the cited scope again, and update the tag only after that review. The checker reports the expected current value but does not write approving prose or renew reviews automatically.

## Coverage policies

Set policies on each reference:

| Option | Obligation |
| --- | --- |
| `noEvidenceExclude` | Require positive evidence; exclusions do not provide coverage. |
| `uniqueEvidence` | Allow at most one distinct claim host to cite each selected unit. |
| `singleEvidencePerSymbol` | Require every selected claim host to cite exactly one selected unit. |
| `requireReview` | Require a matching review with the current target content fingerprint. |
| `checklist` | For Markdown references, require every selected claim host to answer every selected item. |

A checklist's positive citation answers only the named item. It cannot combine with `uniqueEvidence` or `singleEvidencePerSymbol`.

A claim's `evidenceExcludeCarriers` globs restrict where exclusions may be written within its selected files. They cannot combine with a checklist that accepts exclusions.

The root configuration accepts an optional `severity: "off" | "warning" | "error"`, defaulting to `"error"`. Claims and references may override it with their own optional `severity`: a claim inherits the root level, and a reference inherits its claim's level. A claim can also set `disabled: true`.

## Public types

The package exports `IEvidenceConfig`, `IEvidenceClaim`, `IEvidenceReference`, and their shared base interfaces. `IEvidenceClaimBase<Type, SymbolKind>` and `IEvidenceReferenceBase<Type, SymbolKind>` own their common settings and symbol selectors. Both specialize into programming, database, Markdown, and Swagger populations. `IEvidenceSwaggerClaim` selects operations and reads evidence declarations from their descriptions.

`EvidenceProgrammingType` and `EvidenceDatabaseType` define source-language identifiers. `EvidenceProgrammingSymbol`, `EvidenceDatabaseSymbol`, and `EvidenceMarkdownSymbol` define symbol selectors; `EvidenceSeverity` defines diagnostic levels. `IEvidenceDocumentedConfig` selects programming symbols that must carry documentation comments.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm check:format
```

The pnpm workspace contains the published library in `packages/evidence` and logic unit tests in `test`. `pnpm build` compiles through `ttsc` with strict `@ttsc/lint` rules, including `@ttsc/evidence`'s `evidence/singular` rule. `pnpm test` runs exported unit-test functions directly through `ttsx` and `@nestia/e2e`'s `DynamicExecutor`.

Dependency versions are centralized in the family catalogs in `pnpm-workspace.yaml`. Each package and the test workspace extend the shared configuration under `config`. VS Code uses Prettier on save through `.vscode/settings.json`.

The root README and LICENSE are authoritative. During package preparation, `scripts/copy-readme-and-license.js` copies them into `packages/evidence`. Workspace imports resolve to TypeScript source; `publishConfig` supplies the compiled entry points, declarations, and CLI.

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/samchon/evidence/blob/master/LICENSE).
