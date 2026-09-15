const fs = require("node:fs");
const promises = require("node:fs/promises");
const path = require("node:path");

async function collectSourceFiles(directory) {
  const entries = await promises.readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async function collectEntry(entry) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(location);
      if (!entry.isFile()) return [];
      // Imported JSON records such as the grammar pins are emitted by tsc
      // alongside compiled sources and must reach lib for the package to load.
      if (entry.name.endsWith(".json")) return [location];
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts"))
        return [];
      return [location];
    }),
  );
  return children.flat().sort();
}

function collectExportPaths(value) {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectExportPaths);
}

async function findMissingFiles(locations) {
  const missing = await Promise.all(
    locations.map(async function inspectFile(location) {
      try {
        await promises.access(location, fs.constants.R_OK);
        const statistics = await promises.stat(location);
        return statistics.isFile() ? [] : [location];
      } catch {
        return [location];
      }
    }),
  );
  return missing.flat().sort();
}

async function main() {
  const packageRoot = path.resolve(__dirname, "../packages/evid");
  const sourceRoot = path.join(packageRoot, "src");
  const outputRoot = path.join(packageRoot, "lib");
  const manifest = JSON.parse(
    await promises.readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  const sources = await collectSourceFiles(sourceRoot);
  const compiled = sources.flatMap(function mapSource(source) {
    const relative = path.relative(sourceRoot, source);
    if (relative.endsWith(".json")) return [path.join(outputRoot, relative)];
    return [
      path.join(outputRoot, relative.replace(/\.ts$/, ".js")),
      path.join(outputRoot, relative.replace(/\.ts$/, ".d.ts")),
    ];
  });
  const published = [
    manifest.publishConfig.main,
    manifest.publishConfig.types,
    ...collectExportPaths(manifest.publishConfig.exports),
    ...Object.values(manifest.publishConfig.bin),
  ].map(function resolvePublishedPath(location) {
    return path.resolve(packageRoot, location);
  });
  const required = [...new Set([...compiled, ...published])];
  const missing = await findMissingFiles(required);
  if (missing.length !== 0)
    throw new Error(
      [
        "The Evid build did not produce every required file:",
        ...missing.map(function formatMissingFile(location) {
          return `  - ${path.relative(packageRoot, location)}`;
        }),
      ].join("\n"),
    );
  console.log(`Verified compiled output for ${sources.length} Evid sources.`);
}

void main().catch(function reportFailure(error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
