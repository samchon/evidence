import { EvidencePostgresqlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires PostgreSQL's pinned parser variant and reuses it offline.
 *
 * The adapter must request only the configured grammar and preserve a complete schema inventory from the warmed cache.
 *
 * 1. Analyze PostgreSQL input cold while recording grammar requests.
 * 2. Verify the requested variant and complete inventory.
 * 3. Repeat offline and require equivalent analysis.
 */
export async function test_postgresql_acquisition(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("sql");
  const bytes = await TestParserAssets.bytes(grammar);
  const source = TestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE app.Item (id integer);",
  );
  await TestFileSystem.experiment(
    "postgresql-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(Uint8Array.from(bytes));
          },
        },
        async () => new EvidencePostgresqlAdapter().analyze(source),
      );
      TestValidator.equals("cold complete schema", cold.diagnostics, []);
      TestValidator.equals("only selected pinned grammar requested", requests, [
        grammar.wasm.url,
      ]);
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("Offline PostgreSQL cache must not fetch.");
          },
        },
        async () => new EvidencePostgresqlAdapter().analyze(source),
      );
      TestValidator.equals("offline equivalent inventory", warm, cold);
    },
  );
}
