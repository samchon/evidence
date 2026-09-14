const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const prettier = require("prettier");

// Compiles download pins into ordinary package code without downloading or packaging grammar bytes.
async function main() {
  const records = JSON.parse(
    await readFile(path.join(__dirname, "parser-grammars.json"), "utf8"),
  );
  const catalog = path.resolve(
    __dirname,
    "../packages/evidence/src/internal/TreeSitterGrammarCatalog.ts",
  );
  const options = await prettier.resolveConfig(catalog);
  const source = await prettier.format(
    'import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";\n\n' +
      "/** Generated from scripts/parser-grammars.json by scripts/prepare-parser-catalog.js. */\n" +
      "export namespace TreeSitterGrammarCatalog {\n" +
      "/** Returns independent download pins without reading packaged assets or initializing WASM. */\n" +
      "export function list(): IEvidenceGrammar[] { return structuredClone(GRAMMARS); }\n\n" +
      "/** Upstream provenance compiled into the package; payload bytes are acquired separately. */\n" +
      "const GRAMMARS: IEvidenceGrammar[] = " +
      JSON.stringify(records, null, 2) +
      ";\n}\n",
    { ...options, filepath: catalog },
  );
  if (process.argv.slice(2).includes("--check")) {
    if ((await readFile(catalog, "utf8")).replaceAll("\r\n", "\n") !== source)
      throw new Error(
        "The compiled grammar catalog is stale. Run node scripts/prepare-parser-catalog.js.",
      );
  } else await writeFile(catalog, source);
  process.stdout.write(
    `Verified ${records.length} compiled grammar pins; no grammar WASM is packaged.\n`,
  );
}

main().catch(function reportFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
