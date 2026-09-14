const { execFile } = require("node:child_process");
const { mkdtemp, readFile } = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const execute = promisify(execFile);

// Publishes a content-addressed release once, then exercises the real acquisition cache.
async function main() {
  const directory = path.resolve(process.argv[2] || "");
  const temporary = path.resolve(__dirname, "../test/.tmp");
  if (!directory.startsWith(temporary + path.sep))
    throw new Error("Parser publication inputs must be under test/.tmp.");
  const grammar = JSON.parse(
    await readFile(path.join(directory, "grammar.json"), "utf8"),
  );
  const repository = process.env.GITHUB_REPOSITORY || "wrtnlabs/evidence";
  if (grammar.version !== `grammar-${grammar.id}-${grammar.wasm.sha256}`)
    throw new Error(
      "Grammar release must be addressed by its complete digest.",
    );
  if (
    grammar.wasm.url !==
    `https://github.com/${repository}/releases/download/${grammar.version}/${path.basename(grammar.wasm.file)}`
  )
    throw new Error(
      "Grammar URL does not address the intended repository release.",
    );
  const source = await readFile(
    path.join(directory, path.basename(grammar.wasm.file)),
  );
  const {
    TreeSitterAssets,
  } = require("../packages/evidence/lib/internal/TreeSitterAssets");
  const destination = await mkdtemp(path.join(temporary, "published-parser-"));
  const preflight = new TreeSitterAssets({
    cacheDirectory: destination,
    fetch: async () => new Response(source),
    attempts: 1,
  });
  await preflight.bytes(grammar);

  // Existing releases are verified below; reruns never replace or delete assets.
  let exists = false;
  try {
    await execute(
      "gh",
      [
        "release",
        "view",
        grammar.version,
        "--repo",
        repository,
        "--json",
        "tagName",
      ],
      { windowsHide: true },
    );
    exists = true;
  } catch (error) {
    if (!String(error.stderr).includes("release not found")) throw error;
  }
  if (!exists)
    await execute(
      "gh",
      [
        "release",
        "create",
        grammar.version,
        path.join(directory, path.basename(grammar.wasm.file)),
        path.join(directory, "grammar.json"),
        path.join(directory, "provenance.json"),
        "--repo",
        repository,
        "--target",
        process.env.GITHUB_SHA || "master",
        "--title",
        `Parser grammar: ${grammar.id}`,
        "--notes-file",
        path.join(directory, "provenance.json"),
        "--prerelease",
      ],
      { windowsHide: true },
    );

  const cache = await mkdtemp(path.join(temporary, "downloaded-parser-"));
  const assets = new TreeSitterAssets({ cacheDirectory: cache });
  const bytes = await assets.bytes(grammar);
  if (!Buffer.from(bytes).equals(source))
    throw new Error("Published parser differs from the verified build.");
  const offline = new TreeSitterAssets({
    cacheDirectory: cache,
    fetch: async () => {
      throw new Error("offline");
    },
  });
  if (!Buffer.from(await offline.bytes(grammar)).equals(source))
    throw new Error("Warm offline acquisition differs.");
  process.stdout.write(
    `Published and verified cold/warm acquisition: ${grammar.wasm.url}\n`,
  );
}

main().catch(function reportFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
