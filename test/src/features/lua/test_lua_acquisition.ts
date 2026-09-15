import { EvidLuaAdapter, EvidParser, EvidTreeSitterAssetScope } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestParserAssets } from "../../internal/EvidTestParserAssets";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Acquires only the selected Lua grammar and reuses its complete inventory offline.
 *
 * Lazy parser loading must avoid unrelated grammars and cached analysis must survive a failing transport.
 *
 * 1. Fetch the Lua grammar and analyze source. 2. Reanalyze offline from cache. 3. Compare the complete inventories.
 */
export async function test_lua_acquisition(): Promise<void> {
  const parser = new EvidParser();
  const grammar = (await parser.grammars()).find((item) => item.id === "lua");
  await parser.close();
  if (grammar === undefined) throw new Error("Pinned Lua grammar is missing.");
  const pinned = Uint8Array.from(await EvidTestParserAssets.bytes(grammar));
  const snapshot = EvidTestSourceSnapshot.create(
    "contract.lua",
    "return { run = function() end, value = 1 }",
  );
  await EvidTestFileSystem.experiment(
    "lua-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(pinned);
          },
        },
        async () => new EvidLuaAdapter().analyze(snapshot),
      );

      TestValidator.equals("only selected Lua variant transfers", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals("cold full public inventory", cold.units.length, 3);
      TestValidator.equals("cold inventory complete", cold.complete, true);
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidLuaAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline inventory is equivalent", warm, cold);
    },
  );
}
