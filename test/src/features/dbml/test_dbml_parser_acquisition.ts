import {
  EvidenceDbmlAdapter,
  EvidenceParser,
  EvidenceParserError,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Exercises real DBML-only lazy acquisition, offline reuse, independent inventories and preserved query failure. */
export async function test_dbml_parser_acquisition(): Promise<void> {
  const parser = new EvidenceParser();
  const grammar = (await parser.grammars()).find(
    (entry) => entry.id === "dbml",
  );
  await parser.close();
  if (grammar === undefined) throw new Error("The DBML grammar pin is absent.");
  const source = TestSourceSnapshot.create(
    "schema.dbml",
    dedent`
    Table users { id int }
    Table posts { user_id int [ref: > users.id] }
  `,
  );
  await TestFileSystem.experiment(
    "dbml-acquisition",
    {},
    async (cacheDirectory) => {
      const requested: string[] = [];
      const cold = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            const url = input instanceof Request ? input.url : String(input);
            requested.push(url);
            return new Response(
              Uint8Array.from(await TestParserAssets.bytes(grammar)),
            );
          },
        },
        async () => new EvidenceDbmlAdapter().analyze(source),
      );
      TestValidator.equals("only selected DBML variant acquired", requested, [
        grammar.wasm.url,
      ]);
      TestValidator.equals(
        "real grammar cold result complete",
        cold.diagnostics,
        [],
      );
      const warm = await TreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async () => {
            throw new Error("Offline: no network transport.");
          },
        },
        async () => new EvidenceDbmlAdapter().analyze(source),
      );
      TestValidator.equals(
        "offline warm inventory equals cold inventory",
        warm,
        cold,
      );
      warm.units.length = 0;
      TestValidator.equals(
        "fresh inventories share no mutable units",
        cold.units.length,
        5,
      );
      await TreeSitterAssetScope.run({ cacheDirectory }, async () => {
        const queryParser = new EvidenceParser();
        try {
          let code: string | undefined;
          try {
            await queryParser.parse(
              {
                type: "dbml",
                file: "schema.dbml",
                content: "Table users { id int }",
              },
              (session) => session.captures("(not_a_dbml_node) @missing"),
            );
          } catch (cause) {
            if (!(cause instanceof EvidenceParserError)) throw cause;
            code = cause.code;
          }
          TestValidator.equals(
            "query failure retains parser provenance",
            code,
            "query-invalid",
          );
        } finally {
          await queryParser.close();
        }
      });
    },
  );
}
