# Migrate from `@ttsc/evidence`

This guide uses [`@ttsc/evidence` commit `14a22f077caf23f1bfb8a97b3d9db765912074ef`](https://github.com/samchon/ttsc/tree/14a22f077caf23f1bfb8a97b3d9db765912074ef/packages/evidence) as the compatibility baseline. The standalone package keeps the Evidence Graph's obligation model while replacing TypeScript compiler ownership and inline symbol links with configured files and explicit public addresses.

See the [compatibility ledger](development/compatibility.md) for behavior-level source links and regressions.

## Install the standalone checker

```bash
pnpm i -D typescript ttsc @wrtnlabs/evidence
```

Remove `@ttsc/evidence` only after the project no longer uses its companion lint rules. Keep `@ttsc/lint` when other lint rules still depend on it. `@wrtnlabs/evidence` does not register a ttsc lint plugin. It uses `ttsx` from the `ttsc` peer to typecheck and evaluate `evidence.config.ts`.

## Move graph configuration

An original lint configuration embeds the graph under `plugins` and `rules`:

```ts
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
  ],
};

export default {
  plugins: { evidence },
  rules: {
    "evidence/graph": ["error", graph],
  },
} satisfies ITtscLintConfig;
```

Move the graph value into `evidence.config.ts` and put the former outer rule severity on the root:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  severity: "error",
  claims: [
    {
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
  ],
} satisfies IEvidenceConfig;
```

Run the standalone command explicitly:

```bash
pnpm exec evidence check
```

The `type` discriminator names the adapter directly. Do not introduce `type: "code"` or a separate `language` field. TypeScript, C++, Rust, Prisma, Markdown, and Swagger use `type: "typescript"`, `type: "cpp"`, `type: "rust"`, `type: "prisma"`, `type: "markdown"`, and `type: "swagger"` respectively.

## Replace compiler inline links

The compiler plugin can resolve an import-scoped TypeScript symbol:

```ts
/** @evidence {@link Calculator.add} Implements the calculation requirement. */
```

Standalone Evidence has no TypeScript `Program`, language service, or editor link completion for that target. Replace it with the public file address visible in the configured reference:

```ts
/** @evidence ../calculator.ts#Calculator.add Implements the calculation requirement. */
```

Use `Calculator.prototype.add` when the TypeScript member is an instance member. Static members use `Calculator.add`. Namespace data uses `SomeNamespace.property`, and a class itself uses `SomeClass`.

The path resolves from the file carrying the tag. It must name a file selected by the programming reference. The accessor resolves against the public declared-source inventory for that exact reference; Evidence does not search the project for a matching global name.

Run `evidence list --language typescript` to see canonical targets and aliases, then `evidence inspect '<target>'` to verify the migrated address.

## Replace compiler population identity

The standalone config has `root` and `files`; it has no `package` selector and does not derive ownership from a `tsconfig` or package entry point. A relative root resolves from `evidence.config.ts`:

```ts
import type { IEvidenceClaim } from "@wrtnlabs/evidence";

const claim = {
  type: "typescript",
  root: "packages/calculator",
  files: ["src/**/*.ts", "!src/internal/**"],
  reference: {
    type: "markdown",
    root: "../..",
    files: ["docs/requirements.md"],
  },
} satisfies IEvidenceClaim;
```

Pointing `root` at installed or generated source can select those files, but it does not recreate package `exports`, declaration emit, path mapping, project references, or compiler module resolution. Configure the actual declared source that belongs to the Evidence boundary and honor any incomplete-analysis diagnostic.

## Preserve graph behavior

The following graph behavior carries over:

- claims and reference-array entries remain independently complete obligations;
- `symbol` accepts one value or a nonempty array and retains claim/reference defaults;
- Markdown, Prisma, and Swagger target syntax remains stable;
- ancestor citations cover selected descendants;
- `evidenceExcludeCarriers`, `noEvidenceExclude`, `uniqueEvidence`, `singleEvidencePerSymbol`, and Markdown `checklist` retain their per-boundary meaning;
- `requireReview` pairs acknowledgements with current target fingerprints;
- disabled and `off` populations do not load artifacts;
- incomplete discovery or analysis cannot pass as an empty population.

Swagger is broader in the standalone package: an operation can now be a claim host by carrying tags in its `description`. The pinned compiler baseline allowed Swagger only as a reference.

## Graph and companion-rule status

| Original surface | Standalone status | Migration |
| --- | --- | --- |
| `evidence/graph` | **Translated** | Move its options into `evidence.config.ts`; run `evidence check`. Graph coverage, exclusions, checklists, and per-reference policies remain implemented. |
| Outer lint-rule severity | **Translated** | Set optional root `severity`; it defaults to `error`. Claims and references can still override inherited severity. |
| `{@link Symbol}` TypeScript targets | **Translated** | Use `<relative-file>#<public-accessor>`. Compiler autocomplete and import-scope resolution are unavailable. |
| TypeScript `package`, Program, and emitted-module identity | **Deferred** | Select a `root` and file globs. Treat the result as declared-source analysis, not compiler or package export analysis. |
| `evidence/documented` | **Deferred** | There is no standalone command that requires documentation on every selected declaration. `IEvidenceDocumentedConfig` alone does not enforce the rule. |
| `evidence/singular` | **Deferred** | There is no standalone file-name-to-declaration naming rule. Continue using the original lint rule if the project needs it. |
| `evidence/review` | **Deferred as a separate rule** | `requireReview` remains implemented on each graph reference. It does not claim to replace an independent repository-wide review rule. |
| `evidence/todo` | **Deferred** | `evidence list` and graph diagnostics expose configured obligations, but there is no standalone TODO annotation rule. |
| TypeScript diagnostic codes and compiler output | **Translated** | Use `evidence check` exit codes and stable string diagnostic codes in text or `schemaVersion: 1` JSON. |
| Installed-package reference resolution | **Deferred** | Explicit source roots and file targets may reach available source, but package exports and compiler declaration resolution are not inferred. |

Do not remove the old companion rules until their behavior is intentionally replaced or no longer required. Running both packages during migration is valid when their command and lint scopes do not duplicate the same graph obligation.

## CI migration

Replace reliance on the compiler plugin's graph side effect with an explicit command:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm exec evidence check
```

Keep the command's exit status. Exit 1 means the graph was fully analyzed and has Evidence errors. Exit 2 means the configuration or analysis is incomplete. Both must fail CI.

The standalone package pins its certified grammars and downloads only the selected ones into a per-user cache on first use, verified by checksum. CI does not need per-language compiler installations; a cold cache needs network access once, and `EVIDENCE_CACHE_DIR` can point it at a cached directory. It still needs whatever commands the repository uses to build or run its software; Evidence does not replace those checks.

## Review the migration

1. Run `evidence languages` and confirm every configured programming `type` is certified.
2. Run `evidence list` and compare the selected denominator with the intended public declarations.
3. Replace every compiler inline link with a listed file-qualified address.
4. Run `evidence inspect` on aliases, instance members, namespaces, literal segments, Prisma models, and Swagger operations that could be ambiguous.
5. Run `evidence check` and repair incomplete analysis before judging missing coverage.
6. Read every new or changed reason. The command proves addressability and coverage, not truth.

Language-specific declared-source boundaries are listed in [certified languages](languages.md), and exact declaration rules are in [adapter inventories](development/adapter-inventories.md).
