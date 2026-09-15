import { EvidenceParser, EvidenceTreeSitterAssetScope, EvidenceZigAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestParserAssets } from "../../internal/EvidenceTestParserAssets";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Acquires Zig's pinned grammar and reuses it offline.
 *
 * The adapter must request only its selected parser and reproduce the full
 * inventory from a warmed cache.
 *
 * 1. Analyze Zig input cold while recording asset requests.
 * 2. Verify the requested grammar and complete inventory.
 * 3. Repeat offline and require equivalent analysis.
 */
export async function test_zig_acquisition(): Promise<void> {
  const parser = new EvidenceParser();
  const grammars = await parser.grammars();
  await parser.close();
  const grammar = grammars.find((item) => item.id === "zig");
  if (grammar === undefined) throw new Error("Missing pinned Zig grammar.");
  const bytes = await EvidenceTestParserAssets.bytes(grammar);
  const requests: string[] = [];
  async function fetchGrammar(
    input: string | URL | Request,
  ): Promise<Response> {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
    return new Response(Uint8Array.from(bytes));
  }
  async function offline(): Promise<Response> {
    throw new Error("The warm Zig analysis must use its verified cache.");
  }
  await EvidenceTestFileSystem.experiment(
    "zig-acquisition",
    {},
    async (cacheDirectory) => {
      const snapshot = EvidenceTestSourceSnapshot.create(
        "src/Contract.zig",
        "pub const Contract = struct { value: i32, }; ",
      );
      const cold = await EvidenceTreeSitterAssetScope.run(
        { cacheDirectory, fetch: fetchGrammar },
        async () => new EvidenceZigAdapter().analyze(snapshot),
      );
      const warm = await EvidenceTreeSitterAssetScope.run(
        { cacheDirectory, fetch: offline },
        async () => new EvidenceZigAdapter().analyze(snapshot),
      );

      TestValidator.equals(
        "cold Zig analysis is complete",
        cold.complete,
        true,
      );
      TestValidator.equals("cold selected variant only", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals("warm offline inventory equivalence", warm, cold);
    },
  );
}
