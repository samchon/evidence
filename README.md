# @samchon/evidence

An Evidence Graph connects specifications, engineering principles, public code contracts, and tests through explicit citations. `@samchon/evidence` is the standalone, cross-language successor to [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence).

The project is under development. This repository currently provides the pnpm workspace, package build, CLI bootstrap, and package-installation checks. Graph types, configuration loading, language adapters, and evidence checking are tracked in the [implementation roadmap](https://github.com/samchon/evidence/issues/31).

## Installation

The consumer installation contract for a published release is:

```bash
pnpm i -D typescript ttsc @samchon/evidence
```

Node.js 22.15.0 or newer is required. `typescript` and `ttsc` are required peers supplied by the consumer. The `ttsx` executable comes from `ttsc`; there is no separate `ttsx` package to install.

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
pnpm typecheck
pnpm test
pnpm verify:package
pnpm check:format
```

| Path | Purpose |
| --- | --- |
| `packages/evidence` | Published package and `evidence` executable |
| `test` | Private workspace for public-import, CLI, and installed-package verification |
| `config` | Shared strict TypeScript settings |
| `scripts` | TypeScript package-maintenance scripts |
| `.agents/skills` | Project, development, documentation, and delivery workflows |

`pnpm build` builds workspaces in dependency order. `pnpm typecheck` first builds the package declarations consumed by the test workspace, then checks both workspaces and the maintenance scripts. `pnpm test` runs the bootstrap behavior tests. `pnpm verify:package` packs the real package, inspects its contents, and installs it with its required peers into an isolated consumer using the local pnpm cache.

## Package preparation

Edit this root README. The package's `prepack` hook copies the root `README.md` and `LICENSE` into `packages/evidence` whenever the package is packed or published. Its `prepare` hook builds the library during installation and packaging. The generated documentation copies are ignored by Git.

```bash
pnpm --dir packages/evidence pack
```

The tarball contains the compiled entry points, declarations, package metadata, README, and license. The asset allowlist is ready for future grammar WASM and its license notices. Source, test fixtures, and repository skills stay out of the package.

## Contributing

Start with [AGENTS.md](https://github.com/samchon/evidence/blob/master/AGENTS.md) and the relevant repository skills. Follow the execution order in the [roadmap](https://github.com/samchon/evidence/issues/31); issue numbers are identifiers, not implementation priority.

The workspace and agent workflows are adapted from [`samchon/ttsc`](https://github.com/samchon/ttsc). The Evidence domain contract remains the behavioral reference for the forthcoming implementation.

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/samchon/evidence/blob/master/LICENSE).
