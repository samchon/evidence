# @samchon/evidence

An Evidence Graph connects specifications, engineering principles, public code contracts, and tests through explicit citations. `@samchon/evidence` is the standalone, cross-language successor to [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence).

The project is under development. This repository currently provides the pnpm workspace, package build, CLI bootstrap, and logic unit-test setup. Graph types, configuration loading, language adapters, and evidence checking are tracked in the [implementation roadmap](https://github.com/samchon/evidence/issues/31).

## Installation

The consumer installation contract for a published release is:

```bash
pnpm i -D typescript ttsc @samchon/evidence
```

`typescript` and `ttsc` are required peers supplied by the consumer. The `ttsx` executable comes from `ttsc`; there is no separate `ttsx` package to install.

The current CLI supports:

```bash
pnpm exec evidence --help
pnpm exec evidence --version
```

Running `evidence`, `evidence check`, or another unavailable command exits with status 2 and states that no project was checked.

## Evidence declarations

The planned source-language target syntax names a file and one of its public symbols:

```ts
/** @evidence ../calculator.ts#add Implements the addition contract. */
/** @evidence ../SomeClass.ts#SomeClass.member Supplies the public static member. */
/** @evidence ../SomeClass.ts#SomeClass Represents the class contract. */
/** @evidence ../SomeNamespace.ts#SomeNamespace.property Supplies the namespace value. */
```

The checker will read `evidence.config.ts`, typechecked and evaluated through `ttsx`. Source-language parsing will use upstream `web-tree-sitter` and bundled, lazily loaded grammar WASM. Each supported language will also have its own public-symbol and documentation adapter. No language adapters or grammar binaries are shipped by this scaffold yet.

Markdown, Prisma, and Swagger/OpenAPI support will preserve the existing Evidence behavior. A configured graph will require each selected obligation to have evidence or a permitted exclusion, with optional per-host skill checklists and content-sensitive reviews. The checker validates those declarations; reviewers still judge whether their reasons are true.

## Development

Use the pnpm version pinned in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm check:format
```

| Path | Purpose |
| --- | --- |
| `packages/evidence` | Published package and `evidence` executable |
| `test` | Private workspace for logic unit tests |
| `config` | Shared strict TypeScript settings and compiler-enforced lint rules |
| `scripts` | Plain JavaScript package-maintenance scripts |
| `.agents/skills` | Project, development, documentation, and delivery workflows |

`pnpm build` runs `ttsc` across `packages/*` and emits their JavaScript and declarations. Type errors and every enabled lint rule fail the build. There is no separate typecheck command. `@ttsc/lint` is a development dependency. Each package and the test workspace have a `lint.config.ts` extending `config/lint.config.ts`. Its shared rules reject explicit `any`, unsafe type operations, unhandled promises, non-null assertions, ambiguous conditions, and runtime correctness problems. Prettier owns formatting.

`pnpm test` runs `test/src/index.ts` directly through `ttsx`, which checks the source before execution. Following AutoMovie, `@nestia/e2e`'s `DynamicExecutor` discovers exported `test_` functions in `test/src/features/<category>/test_*.ts`; the functions call logic directly and assert results with `TestValidator`. The initial unit test covers command selection, including unsupported and extra arguments. Dependency and peer versions come from the `samchon`, `typescript`, and `utils` catalogs in `pnpm-workspace.yaml`.

CI has two independent Ubuntu workflows: `build.yml` runs `pnpm build`, and `test.yml` runs `pnpm test`. Tests run from TypeScript source and require no preceding package build.

## Package preparation

The package uses CommonJS. Its workspace `main` and `exports` point directly to `./src/index.ts`. JavaScript entry points, declaration paths, and the installed `evidence` executable are defined only in `publishConfig`; pnpm applies these overrides when packing or publishing.

Edit this root README. The package's `prepack` hook builds the library, then runs `scripts/copy-readme-and-license.js` with Node to copy the root `README.md` and `LICENSE` into `packages/evidence` whenever the package is packed or published. The generated documentation copies are ignored by Git. Dependency installation does not build the library.

```bash
pnpm --dir packages/evidence pack
```

The tarball contains the compiled entry points, declarations, package metadata, README, and license. The asset allowlist is ready for future grammar WASM and its license notices. Source, test fixtures, and repository skills stay out of the package.

## Contributing

Start with [AGENTS.md](https://github.com/samchon/evidence/blob/master/AGENTS.md) and the relevant repository skills. Follow the execution order in the [roadmap](https://github.com/samchon/evidence/issues/31); issue numbers are identifiers, not implementation priority.

The workspace and agent workflows are adapted from [`samchon/ttsc`](https://github.com/samchon/ttsc), with the test layout and execution pattern from [`samchon/AutoMovie`](https://github.com/samchon/AutoMovie). The Evidence domain contract remains the behavioral reference for the forthcoming implementation.

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/samchon/evidence/blob/master/LICENSE).
