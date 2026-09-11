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

Markdown preserves its document outline, and Prisma preserves its schema structure. Swagger claims select local JSON/YAML documents with `files` globs. Swagger references use `file` for an exact local JSON/YAML path or an HTTP(S) URL, with an optional `root` for local paths.

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

Markdown paths resolve from the reference population's root. Markdown claims place tags in HTML comments; Prisma claims place them in documentation comments attached to schema declarations.

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

A citation to a containing type, namespace, document section, or model covers its selected descendants. `@evidenceExclude <target> <reason>` records why a selected obligation does not apply, subject to the reference's policy. The checker validates the declaration and its target; reviewers judge whether the explanation is true.

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

The pnpm workspace contains the published library in `packages/evidence` and logic unit tests in `test`. `pnpm build` compiles through `ttsc` with strict `@ttsc/lint` rules. `pnpm test` runs exported unit-test functions directly through `ttsx` and `@nestia/e2e`'s `DynamicExecutor`.

Dependency versions are centralized in the family catalogs in `pnpm-workspace.yaml`. Each package and the test workspace extend the shared configuration under `config`. VS Code uses Prettier on save through `.vscode/settings.json`.

The root README and LICENSE are authoritative. During package preparation, `scripts/copy-readme-and-license.js` copies them into `packages/evidence`. Workspace imports resolve to TypeScript source; `publishConfig` supplies the compiled entry points, declarations, and CLI.

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/samchon/evidence/blob/master/LICENSE).
