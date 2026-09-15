import {
  EvidenceScalaAdapter,
  EvidenceTreeSitterAssetScope,
  EvidenceTreeSitterAssets,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { EvidenceTestParserAssets } from "../../internal/EvidenceTestParserAssets";
import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Acquires the pinned Scala grammar and reuses its warm cache offline.
 *
 * The test records the configured grammar bytes, blocks network acquisition
 * after warming the cache, and analyzes the same Scala snapshot through both
 * paths.
 *
 * 1. Load the pinned Scala grammar and capture its bytes.
 * 2. Analyze a representative Scala source through a cold cache and verify the
 *    request is only for that grammar and the inventory completes.
 * 3. Reopen the warmed cache with network access disabled and verify its inventory
 *    equals the cold result.
 */
export async function test_scala_acquisition(): Promise<void> {
  const grammar = await new EvidenceTreeSitterAssets().grammar("scala");
  const pinned = Uint8Array.from(await EvidenceTestParserAssets.bytes(grammar));
  const snapshot = EvidenceTestSourceSnapshot.create(
    "src/Contract.scala",
    "class Contract { def run = 1; val value = 1 }",
  );
  await EvidenceTestFileSystem.experiment(
    "scala-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await EvidenceTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(pinned);
          },
        },
        async () => new EvidenceScalaAdapter().analyze(snapshot),
      );
      TestValidator.equals("cold Scala analysis complete", cold.complete, true);
      TestValidator.equals("only selected Scala variant acquired", requests, [
        grammar.wasm.url,
      ]);
      const warm = await EvidenceTreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidenceScalaAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline analysis equivalent", warm, cold);
    },
  );
}
