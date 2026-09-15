# Configuration reference

An Evidence configuration is either JSON data or one TypeScript module whose default export is an `IEvidenceConfig` value. Evidence validates the resulting value with `typia`, then applies path, policy, and adapter constraints before loading enabled artifacts.

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

export default {
  severity: "error",
  claims: [
    {
      name: "public services",
      type: "typescript",
      root: ".",
      files: ["src/**/*.ts", "!src/internal/**"],
      symbol: ["type", "function"],
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
        requireReview: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
```

The supported extensions are `.json`, `.ts`, `.cts`, and `.mts`. JSON needs no TypeScript toolchain. For a TypeScript configuration, Evidence creates an isolated temporary project and asks the consumer's `ttsx` to typecheck and evaluate the module. A consumer `tsconfig.json` is neither required nor inherited; `typescript` and `ttsc` must still be resolvable beside the configuration. `.mts` always uses ESM, `.cts` always uses CommonJS, and `.ts` follows the nearest `package.json` `type` field.

Watch dependency discovery follows static imports, exports, and literal `import()` or `require()` calls under their runtime loading mode. Import-mode JavaScript `data:` modules are decoded recursively for builtin, nested data, and absolute file-URL imports; JSON and Wasm data modules are immutable leaves. A data module cannot resolve a relative or package request, and CommonJS cannot `require()` a data URL. Computed module requests remain unsupported because they cannot produce a complete watch set without executing arbitrary dependency selection.

`EvidenceConfigLoader.load()` returns the validated authored value. `EvidenceConfigLoader.plan()` also resolves defaults and removes inactive populations.

## Root configuration

| Property | Type | Required | Behavior |
| --- | --- | --- | --- |
| `claims` | `IEvidenceClaim[]` | Yes | Must contain at least one claim. Each claim creates its own graph boundary. |
| `severity` | `"error" \| "warning" \| "off"` | No | Defaults to `error`. A claim may override it, and a reference may override the claim. |

## Claim properties

Every artifact family has a named claim interface built on `IEvidenceClaimBase`.

| Property | Type | Required | Behavior |
| --- | --- | --- | --- |
| `type` | Implemented artifact type | Yes | Selects the adapter directly, such as `typescript`, `cpp`, `rust`, `prisma`, `markdown`, or `swagger`. |
| `files` | `string[]` | Yes | Ordered file globs relative to `root`. Swagger claims also use globs over local JSON/YAML documents. |
| `reference` | `IEvidenceReference \| IEvidenceReference[]` | Yes | One reference or a nonempty array of independent obligations. |
| `name` | `string` | No | Labels diagnostics. It does not identify or merge a claim. |
| `severity` | Evidence severity | No | Inherits the root. `off` removes the claim and all of its references before artifact loading. |
| `disabled` | `boolean` | No | Defaults to `false`. `true` validates the shape but creates no population, obligation, or watch dependency. |
| `root` | `string` | No | Defaults to the directory containing the config file. It must name one directory, not a glob. |
| `symbol` | Artifact symbol or nonempty array | No | Selects claim hosts. Defaults depend on the artifact family. |
| `evidenceExcludeCarriers` | `string[]` | No | Narrows exclusions to matching files already selected by `files`; it never expands the claim. |

## Reference properties

Every reference uses `IEvidenceReferenceBase` plus one artifact-specific source field.

| Property | Type | Required | Behavior |
| --- | --- | --- | --- |
| `type` | Implemented artifact type | Yes | Selects the referenced adapter independently of the claim type. |
| `root` | `string` | No | Uses the same config-relative directory rules as claim roots. |
| `symbol` | Artifact symbol or nonempty array | No | Selects the units in this obligation's denominator. Defaults depend on family and role. |
| `severity` | Evidence severity | No | Inherits the claim. `off` removes this reference before loading it. |
| `noEvidenceExclude` | `boolean` | No | Defaults to `false`. When true, exclusions fail and provide no coverage for this reference. |
| `uniqueEvidence` | `boolean` | No | Defaults to `false`. At most one distinct positive claim host may cite each selected unit. |
| `singleEvidencePerSymbol` | `boolean` | No | Defaults to `false`. Every selected claim host must cite exactly one selected reference unit. |
| `requireReview` | `boolean` | No | Defaults to `false`. Every accepted acknowledgement needs a matching current review. |
| `checklist` | `boolean` | No | Markdown references only. Defaults to `false`; every selected claim host must answer every selected Markdown item. |

`checklist` cannot combine with `uniqueEvidence` or `singleEvidencePerSymbol`. A claim with `evidenceExcludeCarriers` may use a checklist only when that reference also sets `noEvidenceExclude: true`. Invalid combinations fail configuration before source loading.

## Artifact source fields

| Role and artifact | Source field |
| --- | --- |
| Programming claim or reference | `files: string[]` |
| Markdown claim or reference | `files: string[]` |
| Database claim or reference (`prisma`, `postgresql`, `mysql`, `sqlite`, `bigquery`, `sql`, `dbml`) | `files: string[]`; all selected files form one schema snapshot |
| Swagger claim | `files: string[]`; each matching local document contributes operations |
| Swagger reference | `file: string`; one exact local JSON/YAML path or HTTP(S) URL |

Every `EvidenceDatabaseType` value has a certified adapter: `prisma`, `postgresql`, `mysql`, `sqlite`, `bigquery`, `sql`, and `dbml`. Select the schema language rather than the database server; the configured `type` decides which grammar parses a `.sql` file, and Evidence never infers a dialect from parsing. See [certified languages](languages.md) for each dialect's accepted subset.

## Symbol defaults

| Artifact family | Claim default | Reference default |
| --- | --- | --- |
| Programming | `type`, `function`, `property` | `type` |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | `file`, `h1`, `h2`, `h3`, `h4` |
| Database | `model`, `column`, `relation` | `model` |
| Swagger | `operation` | `operation` |

A selector changes which claim units may host positive evidence or which reference units enter the denominator. Structural ancestors remain addressable for hierarchical coverage. Exclusions may use any supported public declaration in a selected claim file unless `evidenceExcludeCarriers` narrows their locations.

## Paths and globs

Relative roots resolve from the directory containing the selected config file, including when `--cwd` selects the config from another process directory. Absolute roots and directory symbolic links or Windows junctions are accepted. Windows drive-relative paths such as `C:docs` are rejected because their meaning depends on hidden process state.

File patterns run from left to right:

```ts
const files = ["src/**", "!src/internal/**", "src/internal/public.ts"];
```

`*` stays within one path segment, `**` crosses segments, and `?` matches one character. Both slash styles are accepted. A bare `src` or `src/` does not select descendants; use `src/**`. At least one positive pattern is required. Identity remains case-sensitive on every platform.

Programming and Tree-sitter database targets resolve their file path from the source file carrying the tag. Markdown target paths resolve from the Markdown reference root. Prisma uses the virtual `prisma:` address because all selected files form one schema, and Swagger uses `METHOD:/path`. See [tags and targets](tags-and-targets.md) for address syntax.

## Independent references

Reference arrays do not form a union:

```ts
import type { IEvidenceReference } from "@wrtnlabs/evidence";

const references = [
  {
    type: "markdown",
    files: ["docs/requirements.md"],
    symbol: "h2",
  },
  {
    type: "prisma",
    files: ["prisma/schema.prisma"],
    symbol: "model",
  },
] satisfies IEvidenceReference[];
```

The claim must cover every selected Markdown H2 and every selected Prisma model. Coverage in the first reference never fills a gap in the second, even if one tag happens to be syntactically applicable to both.

## Activation and failure states

The planner removes disabled claims, claims whose effective severity is `off`, references whose effective severity is `off`, and claims left with no active references. These populations are not read and do not become watch dependencies.

A complete claim with no selected claim units is inactive. This healthy empty state has no hosts that could make a claim and does not fabricate coverage. A complete reference with no selected units is different: an active obligation reports `graph-empty-reference`, because the configured evidence population did not materialize the expected denominator.

Unreadable paths, invalid encodings, syntax errors, unresolved export boundaries, and adapter-specific semantic gaps remain incomplete. They produce exit code 2 and suppress downstream missing-coverage findings that would be guesses. Fix completeness first, then evaluate the resulting obligations.

## Severity

`error` findings make a complete check exit 1. `warning` findings remain in text and JSON but a complete warning-only check exits 0. Incomplete analysis exits 2 regardless of whether a missing-coverage finding would otherwise be a warning, because the denominator is unavailable.

Use `disabled: true` for a deliberately staged claim whose configuration should still be checked. Use `severity: "off"` when inherited severity controls activation. Neither setting records an exclusion; they remove the whole configured boundary.
