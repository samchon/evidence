import { EvidenceLuaAdapter, EvidenceParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires only the selected real Lua grammar and preserves full inventory on a warm offline run. */
export async function test_lua_acquisition(): Promise<void> {
  const parser = new EvidenceParser();
  const grammar = (await parser.grammars()).find((item) => item.id === "lua");
  await parser.close();
  if (grammar === undefined) throw new Error("Pinned Lua grammar is missing.");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const snapshot = TestSourceSnapshot.create(
    "contract.lua",
    "return { run = function() end, value = 1 }",
  );
  await TestFileSystem.experiment(
    "lua-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(pinned);
          },
        },
        async () => new EvidenceLuaAdapter().analyze(snapshot),
      );

      TestValidator.equals("only selected Lua variant transfers", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals("cold full public inventory", cold.units.length, 3);
      TestValidator.equals("cold inventory complete", cold.complete, true);
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidenceLuaAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline inventory is equivalent", warm, cold);
    },
  );
}
