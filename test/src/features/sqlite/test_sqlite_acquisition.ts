import {
  EvidSqliteAdapter,
  EvidTreeSitterAssetScope,
  EvidTreeSitterAssets,
} from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestParserAssets } from "../../internal/EvidTestParserAssets";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Acquires SQLite's configured WASM parser and reuses it offline.
 *
 * Cold analysis must load one required dialect asset, while a warm cache reproduces the complete inventory without network access.
 *
 * 1. Analyze SQLite input cold while recording requests.
 * 2. Verify the selected transfer and complete inventory.
 * 3. Repeat offline and require equivalent analysis.
 */
export async function test_sqlite_acquisition(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("sqlite");
  const bytes = Uint8Array.from(await EvidTestParserAssets.bytes(grammar));
  const source = EvidTestSourceSnapshot.create(
    "schema.sql",
    'CREATE TABLE "Cold.Cache" ([id] INTEGER PRIMARY KEY) STRICT;',
  );

  await EvidTestFileSystem.experiment(
    "sqlite-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(bytes);
          },
        },
        async () => new EvidSqliteAdapter().analyze(source),
      );
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error(
              "Offline SQLite cache must not perform a transfer.",
            );
          },
        },
        async () => new EvidSqliteAdapter().analyze(source),
      );

      TestValidator.equals("one necessary pinned dialect transfer", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals(
        "cold SQLite extraction complete",
        cold.complete,
        true,
      );
      TestValidator.equals(
        "offline SQLite inventory matches cold result",
        warm,
        cold,
      );
    },
  );
}
