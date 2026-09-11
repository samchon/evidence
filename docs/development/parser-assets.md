# Parser assets

The application uses the official CommonJS entry of `web-tree-sitter`, pinned in the `tree-sitter` family catalog. Language WASM files come from individual upstream Tree-sitter release assets. The [grammar manifest](../../packages/evidence/assets/grammars.json) records each release tag, resolved source commit, download URL, SHA-256 checksum, byte length, and license. TypeScript and TSX share an upstream repository and license but use separate grammars.

The binding's core WASM comes from its pinned npm dependency. Grammar files and their licenses are committed under `packages/evidence/assets` and included by the package allowlist. Runtime initialization reads the installed core bytes through `require.resolve`; grammar paths resolve from the Evidence package. Neither path depends on the caller's working directory. Checking never downloads grammars or invokes native build tools.

## Verify or restore assets

From the workspace root, verify the committed files without network access:

```bash
node scripts/prepare-parser-assets.js --check
```

To restore missing files from their pinned upstream URLs, run:

```bash
node scripts/prepare-parser-assets.js
```

The restore command verifies downloaded bytes before writing them. A changed existing file fails checksum validation; it is not silently replaced. The package's `prepack` hook runs the offline check. Consumers do not run either maintenance command.

## Update a grammar

1. Select an upstream release with a precompiled WASM asset and resolve its tag to a full source commit.
2. Obtain the release asset and the license at that commit. Verify any upstream release checksum, then record both files' byte lengths and SHA-256 digests in the manifest.
3. Commit the new bytes and provenance together. Verify every local asset with the offline command.
4. Add or update the registry's accepted file spellings and the real declaration fixture in `test_parser_grammars`. Run the parser logic tests through the test workspace's `ttsx` entry point.
5. Review successful linking, parsing, query captures, Unicode coordinates, and external-scanner behavior with the installed binding. Matching ABI versions alone do not prove compatibility.

Register Evidence adapter capabilities only after fixtures establish public visibility, symbol kinds, ownership, comment attachment, aliases, and failure handling. An available grammar is syntax support; it does not establish a complete Evidence inventory. The runtime releases parsers, trees, cursors, and per-session queries; immutable language modules remain cached for the process lifetime because the binding exposes no language-unload API.
