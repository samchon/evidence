const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  chmod,
} = require("node:fs/promises");
const { createRequire } = require("node:module");
const path = require("node:path");
const { promisify } = require("node:util");
const { gunzipSync } = require("node:zlib");

const execute = promisify(execFile);
const root = path.resolve(__dirname, "..");
const temporary = path.join(root, "test/.tmp/parser-builds");

// Builds only explicitly selected maintainer recipes. This is never an install or runtime hook.
async function main() {
  const manifest = JSON.parse(
    await readFile(path.join(__dirname, "parser-builds.json"), "utf8"),
  );
  const id = process.argv[2];
  const recipe = manifest.grammars.find((entry) => entry.id === id);
  if (!recipe)
    throw new Error("Select a grammar from scripts/parser-builds.json.");
  const tools = manifest.tools[process.platform];
  if (!tools || process.arch !== "x64")
    throw new Error("Maintainer builds require Linux or Windows x64.");
  await mkdir(temporary, { recursive: true });
  const directory = await mkdtemp(path.join(temporary, id + "-"));
  const platform = process.platform === "win32" ? "windows" : "linux";
  const cli = path.join(
    directory,
    process.platform === "win32" ? "tree-sitter.exe" : "tree-sitter",
  );
  const compressed = await download(
    `https://github.com/tree-sitter/tree-sitter/releases/download/v${manifest.cliVersion}/tree-sitter-${platform}-x64.gz`,
    tools.cliSha256,
  );
  await writeFile(cli, gunzipSync(compressed));
  if (process.platform !== "win32") await chmod(cli, 0o755);
  const sdkName = `wasi-sdk-${manifest.sdkVersion}-x86_64-${platform}`;
  const sdkArchive = path.join(directory, sdkName + ".tar.gz");
  await writeFile(
    sdkArchive,
    await download(
      `https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${manifest.sdkVersion.split(".")[0]}/${sdkName}.tar.gz`,
      tools.sdkSha256,
    ),
  );
  await run("tar", ["-xzf", path.basename(sdkArchive)], { cwd: directory });
  const environment = {
    ...process.env,
    TEMP: directory,
    TMP: directory,
    TMPDIR: directory,
    XDG_CACHE_HOME: path.join(directory, "cache"),
    TREE_SITTER_WASI_SDK_PATH: path.join(directory, sdkName),
  };
  const first = await build(recipe, directory, "first", cli, environment);
  const second = await build(recipe, directory, "second", cli, environment);
  if (!first.bytes.equals(second.bytes))
    throw new Error("Independent builds produced different WASM bytes.");

  await verify(recipe, first.bytes);
  const digest = sha256(first.bytes);
  const tag = `grammar-${id}-${digest}`;
  const wasmName = `tree-sitter-${id}.wasm`;
  const repository = process.env.GITHUB_REPOSITORY || "wrtnlabs/evidence";
  const record = {
    id,
    repository: recipe.repository,
    version: tag,
    commit: recipe.commit,
    wasm: {
      file: `${id}/${wasmName}`,
      url: `https://github.com/${repository}/releases/download/${tag}/${wasmName}`,
      sha256: digest,
      size: first.bytes.length,
    },
    license: {
      file: `${id}/LICENSE`,
      url: `${recipe.repository.replace("https://github.com/", "https://raw.githubusercontent.com/")}/${recipe.commit}/${recipe.license}`,
      sha256: sha256(first.license),
      size: first.license.length,
    },
  };
  const output = path.join(directory, "output");
  await mkdir(output);
  await writeFile(path.join(output, wasmName), first.bytes);
  await writeFile(
    path.join(output, "grammar.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  await writeFile(
    path.join(output, "provenance.json"),
    JSON.stringify(
      {
        recipe,
        cliVersion: manifest.cliVersion,
        sdkVersion: manifest.sdkVersion,
        toolDigests: tools,
        platform: process.platform,
        architecture: process.arch,
        inputs: first.inputs,
        patchBase64: first.patch?.toString("base64"),
        reproducible: true,
        wasmSha256: digest,
        runtimeVersion: JSON.parse(
          await readFile(
            path.join(
              path.dirname(
                createRequire(
                  path.join(root, "packages/evidence/package.json"),
                ).resolve("web-tree-sitter"),
              ),
              "package.json",
            ),
            "utf8",
          ),
        ).version,
      },
      null,
      2,
    ) + "\n",
  );
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = require("node:fs/promises");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `directory=${output}\ntag=${tag}\n`,
    );
  }
  process.stdout.write(`Built, reproduced and parsed ${id}: ${output}\n`);
}

/**
 * Generates and compiles a detached source pin, recording generated and scanner
 * inputs.
 */
async function build(recipe, base, name, cli, env) {
  const checkout = path.join(base, name);
  await mkdir(checkout);
  await run("git", ["init", "--quiet", checkout]);
  await run("git", [
    "-C",
    checkout,
    "remote",
    "add",
    "origin",
    recipe.repository,
  ]);
  await run("git", [
    "-C",
    checkout,
    "fetch",
    "--quiet",
    "--depth",
    "1",
    "origin",
    recipe.commit,
  ]);
  await run("git", [
    "-C",
    checkout,
    "checkout",
    "--quiet",
    "--detach",
    "FETCH_HEAD",
  ]);
  const commit = await run("git", ["-C", checkout, "rev-parse", "HEAD"]);
  if (commit.trim() !== recipe.commit)
    throw new Error("Grammar checkout differs from its source pin.");
  let patchDigest;
  let patchBytes;
  if (recipe.patch) {
    const patch = path.resolve(root, recipe.patch.file);
    const patchRoot = path.join(root, "scripts/parser-patches");
    if (!patch.startsWith(patchRoot + path.sep))
      throw new Error("Grammar patch escapes scripts/parser-patches.");
    patchBytes = await readFile(patch);
    patchDigest = sha256(patchBytes);
    if (patchDigest !== recipe.patch.sha256)
      throw new Error("Grammar patch differs from its pinned digest.");
    await run("git", ["-C", checkout, "apply", "--check", patch]);
    await run("git", ["-C", checkout, "apply", patch]);
  }
  const cwd = path.resolve(checkout, recipe.directory);
  if (cwd !== checkout && !cwd.startsWith(checkout + path.sep))
    throw new Error("Grammar directory escapes the checkout.");
  await run(cli, ["generate", "--abi", String(recipe.abi)], { cwd, env });
  const wasm = path.join(checkout, "parser.wasm");
  await run(cli, ["build", "--wasm", "--output", wasm], { cwd, env });
  const inputs = {};
  if (patchDigest) inputs[recipe.patch.file] = patchDigest;
  const files = [path.join(cwd, "grammar.js")];
  try {
    const metadata = path.join(checkout, "tree-sitter.json");
    inputs["tree-sitter.json"] = sha256(await readFile(metadata));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const entry of await readdir(path.join(cwd, "src"), {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile()) files.push(path.join(entry.parentPath, entry.name));
  for (const file of files.sort())
    inputs[path.relative(checkout, file).replaceAll("\\", "/")] = sha256(
      await readFile(file),
    );
  // Read the immutable Git blob so checkout newline conversion cannot change the URL pin.
  const license = await execute(
    "git",
    ["-C", checkout, "show", `${recipe.commit}:${recipe.license}`],
    { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  inputs[recipe.license] = sha256(license.stdout);
  return {
    bytes: await readFile(wasm),
    license: license.stdout,
    inputs,
    patch: patchBytes,
  };
}

/**
 * Parses a real declaration and queries its name with the installed
 * engine/grammar pair.
 */
async function verify(recipe, bytes) {
  const requireEvidence = createRequire(
    path.join(root, "packages/evidence/package.json"),
  );
  const { Parser, Language, Query } = requireEvidence("web-tree-sitter");
  await Parser.init({
    wasmBinary: await readFile(
      requireEvidence.resolve("web-tree-sitter/web-tree-sitter.wasm"),
    ),
  });
  const language = await Language.load(bytes);
  const parser = new Parser();
  let tree;
  let query;
  try {
    parser.setLanguage(language);
    tree = parser.parse(recipe.smoke.source);
    query = new Query(language, recipe.smoke.query);
    if (!tree || tree.rootNode.hasError)
      throw new Error("Built grammar failed to parse its declaration probe.");
    const captures = query.captures(tree.rootNode);
    if (!captures.some((capture) => capture.node.text === recipe.smoke.capture))
      throw new Error(
        "Built grammar did not capture the declared probe symbol.",
      );
  } finally {
    if (query) query.delete();
    if (tree) tree.delete();
    parser.delete();
  }
}

/** Acquires toolchain bytes only after matching the pinned digest. */
async function download(url, digest) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok)
    throw new Error(`Download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== digest) throw new Error(`Checksum mismatch: ${url}`);
  return bytes;
}

/** Names build inputs and outputs by their complete SHA-256 digest. */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Executes a maintainer tool without a shell or visible background window. */
async function run(command, args, options = {}) {
  const result = await execute(command, args, {
    ...options,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}

main().catch(function reportFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
