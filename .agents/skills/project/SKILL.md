---
name: project
description: Defines the evid workspace, current implementation status, product boundaries, dependencies, and canonical commands. Use when starting repository work or changing package architecture.
---

# Project

## Product

`evid` enforces explicit acknowledgements between specifications, skills, public declarations, and tests. Public configuration types follow `@ttsc/evidence`: Config, Claim, Reference, shared bases, and artifact selectors. Use `Programming` and `Database` for type families. The `type` discriminator names the source language, such as `typescript`, `cpp`, `rust`, `prisma`, `sql`, or `dbml`; do not add a separate `language` setting. Files are selected directly with globs.

Keep programming and database language identifiers in `EvidProgrammingType` and `EvidDatabaseType`. Database languages share one Claim and one Reference interface. Use `model`, `column`, and `relation` as the common database selectors, and `type`, `function`, and `property` for programming declarations. Classes belong to `type`.

The [roadmap](https://github.com/wrtnlabs/evid/issues/31) owns execution order. Follow the [issue campaign skill](../issue-campaign/SKILL.md) when changing issue handoffs or implementation ordering.

## Layout

| Path | Owner |
| --- | --- |
| `packages/evid/src` | Public API entry point and configuration-to-graph checker orchestration |
| `packages/evid/src/adapters/<artifact>` | Public adapter, extraction helpers, and private types for each language or artifact; shared JavaScript/TypeScript extraction lives in `ecmascript` |
| `packages/evid/src/commands` | Reusable CLI command handling and watch execution |
| `packages/evid/src/contexts` | Execution state and indexes owned by facade/controller instances |
| `packages/evid/src/graph` | Semantic inventory, graph evaluation, fingerprints, and queries |
| `packages/evid/src/loaders` | Configuration and local source loading |
| `packages/evid/src/parsers` | Parser sessions, language registry, documentation mapping, and evidence tags |
| `packages/evid/src/programmers` | Namespace algorithms operating on explicit execution contexts |
| `packages/evid/src/reporters` | Check, query, graph, and watch output rendering |
| `packages/evid/src/targets` | Accessor parsing, file-qualified targets, and target resolution |
| `packages/evid/src/internal` | Private implementation helpers and records |
| `packages/evid/src/structures` | Shared adapter contract, configuration, parser, source, and semantic inventory interfaces |
| `packages/evid/src/typings` | Language identifiers, symbol selectors, and diagnostic severity |
| `packages/evid/src/executable` | Small Node CLI bootstraps |
| `packages/evid/src/internal/parser-grammars.json` | Pinned grammar download metadata imported by the runtime asset reader |
| `test/src/index.ts` | DynamicExecutor unit-test entry point |
| `test/src/features/<category>` | Exported logic unit-test functions |
| `config/package.json` | Private workspace with dependencies for shared configuration |
| `config/tsconfig.json` | Shared strict Node/TypeScript settings |
| `config/lint.config.ts` | Shared lint rules extended by each project |
| `scripts` | Plain CommonJS JavaScript maintenance scripts |
| `.github/workflows` | Required repository checks and the release workflow |

## Dependencies And Distribution

Use the root `packageManager` version. Keep `pnpm-workspace.yaml` to package globs and family catalogs: `samchon`, `typescript`, `tree-sitter`, and `utils`. Dependency and peer versions belong there; package manifests use named `catalog:<family>` or `workspace:` references. Do not add pnpm policy options. Consumers explicitly install `typescript`, `ttsc`, and `evid`; the first two remain required peers. `ttsx` is an executable in `ttsc`, not another dependency. `@ttsc/lint` is a development dependency. Each package and the test workspace have their own `lint.config.ts` extending `config/lint.config.ts`; keep shared rules in that common file.

Use `typia` for runtime type checks and `@typia/utils` for `dedent`. Keep both in the `samchon` catalog. Register the development-only `@ttsc/evidence` contributor in each project's lint config and enable `evidence/singular` at error severity in the shared rules.

Keep compiler dependencies in the workspaces that use them, including `config` for its typed lint configuration. The repository root only needs the formatter. Build scripts invoke `ttsc` with its default `tsconfig.json`; shared compiler settings do not declare plugins already discovered from package dependencies.

`EvidParser` uses official `web-tree-sitter` and automatically downloaded, checksum-verified upstream grammars. A language needs an adapter and certification as well as a grammar. Read [the domain skill](evidence/SKILL.md) for the completeness boundary and the [adapter onboarding guide](evidence/adapter-onboarding.md) for grammar acquisition and manifest maintenance. Keep language WASM out of the repository and package allowlist.

Adapters implement `IEvidAdapter` and return serializable inventories. `EvidInventory` reconciles identities, validates ownership, and projects independent populations. `EvidTagParser` consumes mapped documentation after the adapter establishes attachment. Follow the [adapter onboarding guide](evidence/adapter-onboarding.md) for certification and distribution gates and the [adapter inventory guide](evidence/adapter-inventories.md) for extraction and host records.

Use CommonJS; do not add `type: "module"` or an unsupported Node engine constraint. Workspace `main` and `exports` point directly to `./src/index.ts`. JavaScript entry points, declaration paths, and the installed CLI bin belong only in `publishConfig`. Compiled package files go to ignored `lib` directories. Follow [development](../development/SKILL.md) for inert entry points, TypeScript execution, and maintenance scripts, and [documentation](../documentation/SKILL.md#readers-and-ownership) for authoritative README/LICENSE ownership.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start --include <filter>
pnpm format
pnpm check:format
pnpm release
```

`build` compiles and lints `packages/*`. Test commands execute `ttsx -P tsconfig.json src/index.ts`, which checks and executes source without a preceding build. Follow [development validation](../development/SKILL.md#validation) for affected local tests, CI ownership of the full suite, and the prohibition on a separate typecheck command.

Keep CI as independent, single-Ubuntu workflows: `build.yml` runs only the build after dependency setup; `test.yml` runs only tests after dependency setup. Do not add an OS matrix, make tests depend on the build workflow, or prepend a build to `pnpm test`. Keep package compilation in `build` and `prepack`, not an installation-time `prepare` hook.

Both workflows cache `node_modules/.cache/ttsc` after dependency installation and before compilation or tests, using the runner OS and `pnpm-workspace.yaml` hash as the shared cache key.

## Release

Every workspace manifest, private ones included, carries the release version; `pnpm release` runs `bumpp -r` from the root to bump them together, commit, tag `v<version>`, and push. Do not run `pnpm publish` by hand. The `release.yml` workflow publishes `packages/*` through `pnpm run package:<dist-tag>` with `--no-git-checks --provenance`, so the package's `prepack` hook owns the build, parser-asset check, and README/LICENSE copy. A pushed stable `vX.Y.Z` tag publishes `latest` and then creates the GitHub release notes; `scripts/release-guard.js` rejects a tag whose version disagrees with any tracked manifest before anything reaches npm. A prerelease is a manual `workflow_dispatch` on `master` that names the dist-tag (`rc` or `next`) and the exact `x.y.z-rc.n` or `x.y.z-next.n` version; the workflow bumps the manifests, commits them with `[skip ci]`, and publishes under that dist-tag. Releases share one non-cancelling concurrency group. npm authenticates through trusted publishing with the workflow's OIDC token, so the workflow holds no registry secret.
