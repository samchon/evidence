import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserError } from "../../internal/TestParserError";

/** Missing and changed packaged bytes remain explicit failures, including after a repair attempt. */
export async function test_parser_assets(): Promise<void> {
  const original = new TreeSitterAssets();
  const grammar = await original.grammar("python");
  const directory = join(__dirname, "assets-" + randomUUID());

  await TestFileSystem.experiment(directory, {}, async (location) => {
    const assets = new TreeSitterAssets(location);

    // A real pinned record points to a missing file, then to bytes with the wrong digest.
    await TestParserError.expect("asset-missing", () => assets.bytes(grammar));
    await TestFileSystem.save(location, {
      [grammar.wasm.file]: "damaged grammar",
    });
    await TestParserError.expect("asset-corrupt", () => assets.bytes(grammar));

    // Reading intact shipped bytes remains independent of cwd and previous failures.
    const bytes = await original.bytes(grammar);
    TestValidator.equals("intact pinned size", bytes.length, grammar.wasm.size);
  });
}
