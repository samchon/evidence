import { EvidObjcAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTreeSitterAssets } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssets";
import { EvidTreeSitterAssetScope } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires pinned Objective-C syntax and reuses it offline.
 *
 * Cold analysis must request only its required parser assets, and a warm cache must preserve the complete inventory.
 *
 * 1. Analyze Objective-C input on a cold cache while recording requests.
 * 2. Verify the requested grammar and complete cold inventory.
 * 3. Repeat offline and require an equivalent warm result.
 */
export async function test_objc_acquisition(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("objc");
  const bytes = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const snapshot = TestSourceSnapshot.create(
    "src/Contract.h",
    dedent`
    @interface Contract
    @property int value;
    - (void)run;
    @end
  `,
  );

  await TestFileSystem.experiment(
    "objc-acquisition",
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
        async () => new EvidObjcAdapter().analyze(snapshot),
      );
      TestValidator.equals("only necessary grammar is acquired", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals("cold analysis is complete", cold.complete, true);
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidObjcAdapter().analyze(snapshot),
      );
      TestValidator.equals(
        "warm offline inventory matches cold run",
        warm,
        cold,
      );
    },
  );
}
