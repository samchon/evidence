import { EvidenceParser, EvidenceSqlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Loads only the configured real SQL grammar and preserves complete adapter results through warm offline recovery. */
export async function test_sql_parser(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("sql");
  const bytes = await TestParserAssets.bytes(grammar);
  const snapshot = TestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE account (id INTEGER);",
  );
  await TestFileSystem.experiment(
    "sql-parser-cache",
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
        async () => new EvidenceSqlAdapter().analyze(snapshot),
      );
      TestValidator.equals("cold SQL source complete", cold.complete, true);
      TestValidator.equals(
        "only configured pinned variant requested",
        requests,
        [grammar.wasm.url],
      );
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        async () => new EvidenceSqlAdapter().analyze(snapshot),
      );
      TestValidator.equals("warm offline inventory equivalence", warm, cold);
    },
  );
  const parser = new EvidenceParser();
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
