import { EvidenceScalaAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires only the pinned Scala variant and reproduces a complete inventory from an offline warm cache. */
export async function test_scala_acquisition(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("scala");
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
      const cold = await TreeSitterAssetScope.run(
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
      const warm = await TreeSitterAssetScope.run(
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
