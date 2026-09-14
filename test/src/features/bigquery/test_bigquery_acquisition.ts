import { EvidenceBigQueryAdapter, EvidenceParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestParserError } from "../../internal/TestParserError";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Acquires the selected GoogleSQL grammar and reuses its cached inventory offline.
 *
 * The parser boundary must load BigQuery alone and preserve a completed schema analysis after the network becomes unavailable.
 *
 * 1. Fetch the configured BigQuery WASM once and analyze an ARRAY<STRUCT> table without diagnostics.
 * 2. Reanalyze from the populated cache with a failing fetch callback and require the identical inventory.
 * 3. Parse the schema directly, then reject a TypeScript extension and an unsupported GoogleSQL query capture.
 */
export async function test_bigquery_acquisition(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("bigquery");
  const bytes = await TestParserAssets.bytes(grammar);
  const source = TestSourceSnapshot.create(
    "schema.bqsql",
    "CREATE TABLE ds.orders (items ARRAY<STRUCT<sku STRING>>);",
  );
  await TestFileSystem.experiment(
    "bigquery-acquisition",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(Uint8Array.from(bytes));
          },
        },
        async () => new EvidenceBigQueryAdapter().analyze(source),
      );
      TestValidator.equals("only configured grammar downloaded", requests, [
        grammar.wasm.url,
      ]);
      TestValidator.equals(
        "cold declared schema complete",
        cold.diagnostics,
        [],
      );
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          attempts: 1,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidenceBigQueryAdapter().analyze(source),
      );
      TestValidator.equals("warm offline inventory is equivalent", warm, cold);
    },
  );

  const parser = new EvidenceParser();
  try {
    await parser.parse(
      {
        type: "bigquery",
        file: "schema.sql",
        content: source.files[0]?.content ?? "",
      },
      (session) => {
        TestValidator.equals(
          "independent GoogleSQL root",
          session.root.type,
          "source_file",
        );
      },
    );
    TestValidator.equals(
      "only configured variant loaded",
      parser.state().languages,
      ["bigquery"],
    );
    await TestParserError.expect("unsupported-extension", () =>
      parser.parse(
        {
          type: "bigquery",
          file: "schema.ts",
          content: "export class Order {}",
        },
        () => undefined,
      ),
    );
    await TestParserError.expect("query-invalid", () =>
      parser.parse(
        {
          type: "bigquery",
          file: "schema.sql",
          content: "CREATE TABLE ds.orders (id INT64);",
        },
        (session) => session.captures("(unsupported_google_sql_node) @unit"),
      ),
    );
  } finally {
    await parser.close();
  }
}
