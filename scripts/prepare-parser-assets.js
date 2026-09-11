const { createHash, randomUUID } = require("node:crypto");
const { readFile, mkdir, writeFile, rename, rm } = require("node:fs/promises");
const path = require("node:path");

// This explicit maintainer command restores pinned assets; it is never an install hook.
async function main() {
  const directory = path.resolve(__dirname, "../packages/evidence/assets");
  const records = JSON.parse(
    await readFile(path.join(directory, "grammars.json"), "utf8"),
  );
  const check = process.argv.slice(2).includes("--check");
  const assets = new Map();
  for (const record of records) {
    assets.set(record.wasm.file, record.wasm);
    assets.set(record.license.file, record.license);
  }

  for (const asset of assets.values()) {
    const destination = path.resolve(directory, asset.file);
    const relative = path.relative(directory, destination);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Asset path escapes the package: " + asset.file);

    let bytes;
    try {
      bytes = await readFile(destination);
    } catch (error) {
      if (error.code !== "ENOENT" || check) throw error;
      const response = await fetch(asset.url);
      if (!response.ok)
        throw new Error(
          "Asset download failed: " + asset.url + " (" + response.status + ")",
        );
      bytes = Buffer.from(await response.arrayBuffer());
    }

    if (
      bytes.length !== asset.size ||
      createHash("sha256").update(bytes).digest("hex") !== asset.sha256
    )
      throw new Error("Asset checksum mismatch: " + asset.file);

    if (!check) {
      await mkdir(path.dirname(destination), { recursive: true });
      const temporary = destination + "." + randomUUID() + ".tmp";
      try {
        await writeFile(temporary, bytes);
        await rename(temporary, destination);
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }
  process.stdout.write("Verified " + assets.size + " pinned parser assets.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
