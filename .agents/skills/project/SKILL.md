---
name: project
description: Defines the Evidence workspace, current implementation status, product boundaries, dependencies, and canonical commands. Use when starting repository work or changing package architecture.
---

# Project

## Product

`@samchon/evidence` will enforce explicit acknowledgements between specifications, skills, public declarations, and tests. The package scaffold currently provides an inert public entry point and a CLI with help/version. Checking is unavailable and exits 2. Do not describe planned adapters, config evaluation, or policies as shipped behavior.

The [roadmap](https://github.com/samchon/evidence/issues/31) owns execution order. Package setup precedes common type declarations and configuration loading. GitHub issue numbers are stable identifiers; adjust ordering in the roadmap instead of moving issue contents between numbers.

## Layout

| Path | Owner |
| --- | --- |
| `packages/evidence/src` | Library and reusable CLI implementation |
| `packages/evidence/src/executable` | Small Node CLI bootstraps |
| `packages/evidence/assets` | Future packaged grammar WASM and license notices |
| `test/src/index.ts` | DynamicExecutor unit-test entry point |
| `test/src/features/<category>` | Exported logic unit-test functions |
| `config/tsconfig.json` | Shared strict Node/TypeScript settings |
| `scripts` | TypeScript maintenance scripts |
| `.github/workflows` | Required repository checks |

## Dependencies And Distribution

Use the root `packageManager` version. Keep `pnpm-workspace.yaml` to package globs and family catalogs: `samchon`, `typescript`, and `utils`. Dependency and peer versions belong there; package manifests use named `catalog:<family>` or `workspace:` references. Do not add pnpm policy options. Consumers explicitly install `typescript`, `ttsc`, and `@samchon/evidence`; the first two remain required peers. `ttsx` is an executable in `ttsc`, not another dependency. `@ttsc/lint` is a development dependency and uses the root `lint.config.ts` for every project.

The application and adapters are authored in TypeScript. Future parser support uses official `web-tree-sitter` and packaged upstream grammars. A language needs an adapter and certification as well as a grammar. Read [the domain skill](evidence/SKILL.md) for the completeness boundary.

Use CommonJS; do not add `type: "module"` or an unsupported Node engine constraint. The public module must remain inert on import. Workspace `main` and `exports` point directly to `./src/index.ts`. JavaScript entry points, declaration paths, and the installed CLI bin belong only in `publishConfig`. CLI bootstrap belongs in `src/executable`; reusable behavior belongs outside it. Compiled package files go to ignored `lib` directories. Run TypeScript tests and maintenance scripts with `ttsx`. Root README and LICENSE are authoritative and copied by `prepack`; never maintain the generated package copies independently.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm format
pnpm check:format
```

`build` is the single type and lint gate: it emits the package and checks tests, lint configuration, and maintenance scripts without emitting those projects. Do not add a separate typecheck command. `test` builds the test workspace and runs `ttsx -P tsconfig.json src/index.ts`. Follow AutoMovie's DynamicExecutor and exported `test_` function convention. Tests cover logic directly; do not add package-installation experiments, tarball tests, or CLI process tests.
