import { EvidenceSqliteAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires only the configured SQLite WASM and reproduces a complete inventory from a warm offline cache. */
export async function test_sqlite_acquisition(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("sqlite");
  const bytes = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const source = TestSourceSnapshot.create(
    "schema.sql",
    'CREATE TABLE "Cold.Cache" ([id] INTEGER PRIMARY KEY) STRICT;',
  );

  await TestFileSystem.experiment(
    "sqlite-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(bytes);
          },
        },
        async () => new EvidenceSqliteAdapter().analyze(source),
      );
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error(
              "Offline SQLite cache must not perform a transfer.",
            );
          },
        },
        async () => new EvidenceSqliteAdapter().analyze(source),
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
