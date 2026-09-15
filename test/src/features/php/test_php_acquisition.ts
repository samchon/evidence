import {
  EvidenceLanguageRegistry,
  EvidenceParser,
  EvidencePhpAdapter,
  EvidenceTreeSitterAssets,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestParserAssets } from "../../internal/EvidenceTestParserAssets";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Acquires the selected PHP grammar and preserves warm analysis.
 *
 * PHP analysis must load only its configured full grammar and reproduce
 * complete output from an offline cache.
 *
 * 1. Analyze PHP input cold while recording parser requests.
 * 2. Verify the selected variant and complete inventory.
 * 3. Repeat offline and require equivalent output.
 */
export async function test_php_acquisition(): Promise<void> {
  const selected = EvidenceLanguageRegistry.select("php", "contract.php");
  const grammar = await new EvidenceTreeSitterAssets().grammar(selected.id);
  const pinned = Uint8Array.from(await EvidenceTestParserAssets.bytes(grammar));
  await EvidenceTestFileSystem.experiment(
    "php-acquisition",
    {},
    async (directory) => {
      const requests: string[] = [];
      const cold = new EvidenceTreeSitterAssets({
        cacheDirectory: directory,
        fetch: async (url) => {
          requests.push(String(url));
          return new Response(pinned);
        },
      });
      const coldBytes = await cold.bytes(grammar);
      const offline = new EvidenceTreeSitterAssets({
        cacheDirectory: directory,
        attempts: 1,
        fetch: async () => {
          throw new Error("Unexpected offline acquisition");
        },
      });

      TestValidator.equals("one selected PHP variant acquired", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals(
        "verified warm PHP bytes match",
        Buffer.from(await offline.bytes(grammar)).equals(
          Buffer.from(coldBytes),
        ),
        true,
      );
    },
  );

  const source = EvidenceTestSourceSnapshot.create(
    "contract.php",
    "<?php class Contract { public int $value = 1; }",
  );
  const cold = await new EvidencePhpAdapter().analyze(source);
  const warm = await new EvidencePhpAdapter().analyze(source);
  TestValidator.equals("warm analysis preserves inventory", warm, cold);
  TestValidator.equals(
    "real PHP grammar yields complete analysis",
    warm.complete,
    true,
  );
  const parser = new EvidenceParser();
  try {
    await parser.parse(
      { type: "php", file: "contract.php", content: "<?php function run() {}" },
      (session) =>
        session
          .captures("(function_definition name: (name) @name)")
          .map((capture) => capture.node.text),
    );
    TestValidator.equals(
      "unrelated PHP-only grammar stays unloaded",
      parser.state().languages,
      [selected.id],
    );
  } finally {
    await parser.close();
  }
}
