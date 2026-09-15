import { EvidScalaAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { EvidTreeSitterAssetScope } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssetScope";
import { EvidTreeSitterAssets } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssets";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Acquires the pinned Scala grammar and reuses its warm cache offline.
 *
 * The test records the configured grammar bytes, blocks network acquisition after warming the cache, and analyzes the same Scala snapshot through both paths.
 *
 * 1. Load the pinned Scala grammar and capture its bytes.
 * 2. Analyze a representative Scala source through a cold cache and verify the request is only for that grammar and the inventory completes.
 * 3. Reopen the warmed cache with network access disabled and verify its inventory equals the cold result.
 */
export async function test_scala_acquisition(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("scala");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const snapshot = TestSourceSnapshot.create(
    "src/Contract.scala",
    "class Contract { def run = 1; val value = 1 }",
  );
  await TestFileSystem.experiment(
    "scala-acquisition",
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
        async () => new EvidScalaAdapter().analyze(snapshot),
      );
      TestValidator.equals("cold Scala analysis complete", cold.complete, true);
      TestValidator.equals("only selected Scala variant acquired", requests, [
        grammar.wasm.url,
      ]);
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidScalaAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline analysis equivalent", warm, cold);
    },
  );
}
