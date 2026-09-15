import {
  EvidParser,
  EvidSqlAdapter,
  EvidTreeSitterAssetScope,
  EvidTreeSitterAssets,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestParserAssets } from "../../internal/EvidTestParserAssets";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Loads the configured SQL grammar and preserves offline adapter analysis.
 *
 * Cold acquisition must request only SQL parser assets, and the warmed cache
 * must produce the same complete inventory.
 *
 * 1. Analyze SQL source cold while recording asset requests.
 * 2. Verify complete extraction and SQL-only parser state.
 * 3. Analyze again offline and require equivalent inventory.
 */
export async function test_sql_parser(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("sql");
  const bytes = await EvidTestParserAssets.bytes(grammar);
  const snapshot = EvidTestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE account (id INTEGER);",
  );
  await EvidTestFileSystem.experiment(
    "sql-parser-cache",
    {},
    async (cacheDirectory) => {
      const requests: string[] = [];
      const cold = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            requests.push(String(input));
            return new Response(Uint8Array.from(bytes));
          },
        },
        async () => new EvidSqlAdapter().analyze(snapshot),
      );
      TestValidator.equals("cold SQL source complete", cold.complete, true);
      TestValidator.equals(
        "only configured pinned variant requested",
        requests,
        [grammar.wasm.url],
      );
      const warm = await EvidTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidSqlAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline inventory equivalence", warm, cold);
    },
  );
  const parser = new EvidParser();
  try {
    const names = await parser.parse(
      {
        type: "sql",
        file: "schema.sql",
        content: snapshot.files[0]?.content ?? "",
      },
      (session) =>
        session
          .captures(
            "(create_table (object_reference name: (identifier) @name))",
          )
          .map((capture) => capture.node.text),
    );
    TestValidator.equals("real SQL query capture", names, ["account"]);
    TestValidator.equals("SQL-only parser runtime", parser.state().languages, [
      "sql",
    ]);
  } finally {
    await parser.close();
  }
}
