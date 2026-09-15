import {
  EvidObjcAdapter,
  EvidTreeSitterAssetScope,
  EvidTreeSitterAssets,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestParserAssets } from "../../internal/EvidTestParserAssets";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Acquires pinned Objective-C syntax and reuses it offline.
 *
 * Cold analysis must request only its required parser assets, and a warm cache
 * must preserve the complete inventory.
 *
 * 1. Analyze Objective-C input on a cold cache while recording requests.
 * 2. Verify the requested grammar and complete cold inventory.
 * 3. Repeat offline and require an equivalent warm result.
 */
export async function test_objc_acquisition(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("objc");
  const bytes = Uint8Array.from(await EvidTestParserAssets.bytes(grammar));
  const snapshot = EvidTestSourceSnapshot.create(
    "src/Contract.h",
    dedent`
    @interface Contract
    @property int value;
    - (void)run;
    @end
  `,
  );

  await EvidTestFileSystem.experiment(
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
