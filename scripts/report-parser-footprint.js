const { readFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const { promisify } = require("node:util");
const { gzip } = require("node:zlib");

// Measures exact parser bytes, not a packed package, installed dependencies, or process memory.
async function main() {
  const packageDirectory = path.resolve(__dirname, "../packages/evidence");
  const requireFromPackage = createRequire(
    path.join(packageDirectory, "package.json"),
  );
  const records = JSON.parse(
    await readFile(path.join(__dirname, "parser-grammars.json"), "utf8"),
  );
  const compress = promisify(gzip);

  async function measure(bytes) {
    return {
      bytes: bytes.length,
      gzipBytes: (await compress(bytes, { level: 9 })).length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  const grammars = [];
  for (const record of records) {
    const response = await fetch(record.wasm.url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `Grammar download failed: ${record.id} (HTTP ${response.status})`,
      );
    const measurement = await measure(
      Buffer.from(await response.arrayBuffer()),
    );
    if (
      measurement.sha256 !== record.wasm.sha256 ||
      measurement.bytes !== record.wasm.size
    )
      throw new Error("Grammar checksum mismatch: " + record.id);
    grammars.push({ id: record.id, version: record.version, ...measurement });
  }

  const bindingEntry = requireFromPackage.resolve("web-tree-sitter");
  const bindingManifest = JSON.parse(
    await readFile(
      path.join(path.dirname(bindingEntry), "package.json"),
      "utf8",
    ),
  );
  const report = {
    scope:
      "WASM assets and the loaded CommonJS binding only; excludes package archives, declarations, maps, licenses, other dependencies, and process memory",
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      zlib: process.versions.zlib,
    },
    compression:
      "Each file compressed independently with gzip level 9; sums are not tarball sizes",
    binding: {
      version: bindingManifest.version,
      commonjs: await measure(await readFile(bindingEntry)),
      wasm: await measure(
        await readFile(
          requireFromPackage.resolve("web-tree-sitter/web-tree-sitter.wasm"),
        ),
      ),
    },
    grammars,
    grammarTotals: {
      bytes: grammars.reduce((total, grammar) => total + grammar.bytes, 0),
      gzipBytes: grammars.reduce(
        (total, grammar) => total + grammar.gzipBytes,
        0,
      ),
    },
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
