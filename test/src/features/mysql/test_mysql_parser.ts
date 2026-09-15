import { EvidenceMysqlAdapter, EvidenceParser, EvidenceTreeSitterAssetScope } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestParserAssets } from "../../internal/EvidenceTestParserAssets";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Acquires the selected MySQL grammar and reuses it offline.
 *
 * Parser acquisition must request only the configured grammar, then reproduce
 * the same complete inventory from its warmed local cache.
 *
 * 1. Analyze a MySQL source with a cold parser cache while recording downloads.
 * 2. Require only MySQL parser assets and a complete cold result.
 * 3. Analyze again offline and require an equivalent warm inventory.
 */
export async function test_mysql_parser(): Promise<void> {
  const parser = new EvidenceParser();
  const grammar = (await parser.grammars()).find(
    (entry) => entry.id === "mysql",
  );
  await parser.close();
  if (grammar === undefined) throw new Error("Missing pinned MySQL grammar.");
  const downloadUrl = grammar.wasm.url;
  const bytes = await EvidenceTestParserAssets.bytes(grammar);
  const downloads: string[] = [];
  const snapshot = EvidenceTestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE Contract (`value.part` INT);",
  );

  await EvidenceTestFileSystem.experiment(
    "mysql-parser-cache",
    {},
    async (directory) => {
      const cold = await EvidenceTreeSitterAssetScope.run(
        { cacheDirectory: directory, fetch: download },
        async () => new EvidenceMysqlAdapter().analyze(snapshot),
      );
      TestValidator.equals(
        "cold MySQL inventory is complete",
        cold.diagnostics,
        [],
      );
      TestValidator.equals("only MySQL bytes are acquired", downloads, [
        grammar.wasm.url,
      ]);
      const warm = await EvidenceTreeSitterAssetScope.run(
        { cacheDirectory: directory, fetch: offline },
        async () => new EvidenceMysqlAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline analysis is equivalent", warm, cold);
    },
  );

  async function download(input: string | URL | Request): Promise<Response> {
    const url = input instanceof Request ? input.url : String(input);
    downloads.push(url);
    if (url !== downloadUrl) throw new Error("Unrelated grammar requested.");
    return new Response(Uint8Array.from(bytes));
  }

  async function offline(): Promise<Response> {
    throw new Error("Network is unavailable for the warm-cache check.");
  }
}
