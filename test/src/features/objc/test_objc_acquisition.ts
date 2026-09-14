import { EvidenceObjcAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires only pinned Objective-C syntax on a cold run and returns an equivalent warm offline inventory. */
export async function test_objc_acquisition(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("objc");
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
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(bytes);
          },
        },
        async () => new EvidenceObjcAdapter().analyze(snapshot),
      );
      TestValidator.equals("only necessary grammar is acquired", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals("cold analysis is complete", cold.complete, true);
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidenceObjcAdapter().analyze(snapshot),
      );
      TestValidator.equals(
        "warm offline inventory matches cold run",
        warm,
        cold,
      );
    },
  );
}
