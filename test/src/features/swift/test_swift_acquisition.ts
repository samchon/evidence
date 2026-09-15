import { EvidSwiftAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTreeSitterAssets } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssets";
import { EvidTreeSitterAssetScope } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires the pinned Swift parser and reuses it offline.
 *
 * Cold and warm analysis must produce the same complete inventory.
 *
 * 1. Record cold parser acquisition.
 * 2. Verify the selected asset and warm offline equivalence.
 */
export async function test_swift_acquisition(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("swift");
  const bytes = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const source = TestSourceSnapshot.create(
    "src/Contract.swift",
    "public struct Contract { public var value = 1 }",
  );

  await TestFileSystem.experiment(
    "swift-acquisition",
    {},
    async (directory) => {
      const requests: string[] = [];
      const cold = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory: directory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(bytes);
          },
        },
        () => new EvidSwiftAdapter().analyze(source),
      );
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory: directory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        () => new EvidSwiftAdapter().analyze(source),
      );

      TestValidator.equals(
        "cold analysis requests only the necessary Swift variant",
        requests,
        [grammar.wasm.url],
      );
      TestValidator.equals("cold source is complete", cold.complete, true);
      TestValidator.equals("warm offline analysis is equivalent", warm, cold);
    },
  );
}
