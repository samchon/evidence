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
| `test/src/features` | Public-import and CLI behavior tests |
| `test/src/package` | Actual tarball and independent-consumer verification |
| `test/src/internal` | Shared test-only helpers |
| `config/tsconfig.json` | Shared strict Node/TypeScript settings |
| `scripts` | TypeScript maintenance scripts |
| `.github/workflows` | Required repository checks |

## Dependencies And Distribution

Use the root `packageManager` version and pnpm workspace catalog. Consumers explicitly install `typescript`, `ttsc`, and `@samchon/evidence`; the first two remain required peers. `ttsx` is an executable in `ttsc`, not another dependency. Do not introduce `@ttsc/lint` as a host requirement.

The application and adapters are authored in TypeScript. Future parser support uses official `web-tree-sitter` and packaged upstream grammars. A language needs an adapter and certification as well as a grammar. Read [the domain skill](evidence/SKILL.md) for the completeness boundary.

The public module must remain inert on import. CLI bootstrap belongs in `src/executable`; reusable behavior belongs outside it. Compiled files go to ignored `lib` directories. Root README and LICENSE are authoritative and copied by `prepack`; never maintain the generated package copies independently.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm verify:package
pnpm format
pnpm check:format
```

`typecheck` builds the package declarations before checking their test consumers. `verify:package` needs dependencies installed first so its isolated consumer can install the same peer versions offline. For a CLI/bootstrap change run `test`; for package metadata, build, README copying, executable, or peer changes also run `verify:package`.
