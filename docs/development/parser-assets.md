# Parser assets

The application uses the official CommonJS entry of `web-tree-sitter`, pinned in the `tree-sitter` family catalog. The binding's core WASM comes from that npm dependency and is resolved through `require.resolve`, independent of the caller's working directory.

Language grammars are not packaged. The [grammar manifest](../../packages/evidence/src/internal/parser-grammars.json) pins every grammar that the runtime may acquire: upstream repository, release or reproducible build identifier, full source commit, WASM download URL, SHA-256 digest, byte length, and the license asset with its own digest and length. `TreeSitterAssets` imports the manifest directly, validates every record with `typia`, rejects duplicate identifiers, and refuses non-HTTPS or credential-bearing URLs before any record can choose a cache key or download destination. TypeScript and TSX share an upstream repository and license but use separate grammars.

## Acquisition at runtime

`TreeSitterAssetCache` downloads a pinned grammar the first time a selected source needs it, verifies the byte length and SHA-256 against the manifest, and publishes the file atomically under `grammars-v1/<sha256>.wasm` in the per-user cache. Every later read verifies size and digest again, so a damaged entry is downloaded afresh instead of being trusted. Concurrent callers in one process share a transfer and receive independent byte arrays; a cross-process lock prevents two processes from publishing the same entry at once, and stale locks from dead processes are recovered.

The cache root is `EVIDENCE_CACHE_DIR` when set, otherwise the platform user cache described in the root README. `ITreeSitterAssetOptions` lets an embedding caller override the cache directory, fetch transport, per-attempt timeout, attempt count, cancellation signal, and progress sink; `TreeSitterAssetScope` carries those controls through one asynchronous execution chain so nested checker and adapter instances inherit them. Imports, configuration loading, help, version, init, and `evidence languages` never download a grammar.

## Tests and CI

Logic tests obtain the real pinned grammars into the gitignored `test/.tmp/parser-fixtures` cache through `TestParserAssets`. A cold checkout therefore needs network access once; the test workflow caches that directory keyed by the manifest's hash. Acquisition tests copy those verified bytes into a disposable cache and drive a controlled fetch implementation, so cold, warm, offline, corrupt, and repair paths are exercised without touching the shared fixtures. `test_parser_assets` and the `test_parser_acquisition_*` scenarios in `test/src/features/parser` own that coverage.

## Add or update a grammar

1. Choose an upstream release that publishes a WASM asset compatible with the pinned `web-tree-sitter` ABI, and resolve its tag to a full source commit. If upstream publishes no WASM, add a recipe to `scripts/parser-builds.json` and let the `parser-wasm` workflow build, verify, and publish it as described in the root README.
2. Obtain the WASM and the license at that commit. Record both files' byte lengths and SHA-256 digests, the download URLs, the repository, the version, and the commit as one record in the manifest. Register a record only alongside its implemented, certified adapter.
3. Add the grammar ID and its exact extensions or special filenames to `EvidenceLanguageRegistry`.
4. Add a real declaration fixture to `test_parser_grammars` and run the parser logic tests through the test workspace: `pnpm start --include parser`.
5. Review successful linking, parsing, query captures, Unicode coordinates, and external-scanner behavior with the installed binding. Matching ABI versions alone do not prove compatibility.

Register an Evidence adapter only after fixtures establish public visibility, symbol kinds, ownership, comment attachment, aliases, and conservative failure handling. An available grammar proves syntax support; it does not establish a complete Evidence inventory. The runtime releases parsers, trees, cursors, and per-session queries. Immutable language modules remain cached for the process lifetime because the binding exposes no language-unload API.
