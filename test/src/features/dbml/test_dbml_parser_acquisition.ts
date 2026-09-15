import {
  EvidenceDbmlAdapter,
  EvidenceParser,
  EvidenceParserError,
  EvidenceTreeSitterAssetScope,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestParserAssets } from "../../internal/EvidenceTestParserAssets";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Acquires the real DBML grammar lazily and preserves parser behavior from
 * cache.
 *
 * DBML analysis must download only its selected grammar, then return an
 * equivalent but independently mutable inventory when offline.
 *
 * 1. Fetch the pinned DBML grammar and analyze a table-and-reference schema
 *    without diagnostics.
 * 2. Reanalyze with no network transport and compare the warm inventory with the
 *    cold result, then mutate warm units without affecting cold units.
 * 3. Issue an invalid DBML query and require the parser to retain its
 *    query-invalid provenance.
 */
export async function test_dbml_parser_acquisition(): Promise<void> {
  const parser = new EvidenceParser();
  const grammar = (await parser.grammars()).find(
    (entry) => entry.id === "dbml",
  );
  await parser.close();
  if (grammar === undefined) throw new Error("The DBML grammar pin is absent.");
  const source = EvidenceTestSourceSnapshot.create(
    "schema.dbml",
    dedent`
    Table users { id int }
    Table posts { user_id int [ref: > users.id] }
  `,
  );
  await EvidenceTestFileSystem.experiment(
    "dbml-acquisition",
    {},
    async (cacheDirectory) => {
      const requested: string[] = [];
      const cold = await EvidenceTreeSitterAssetScope.run(
        {
          cacheDirectory,
          fetch: async (input) => {
            const url = input instanceof Request ? input.url : String(input);
            requested.push(url);
            return new Response(
              Uint8Array.from(await EvidenceTestParserAssets.bytes(grammar)),
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
      const warm = await EvidenceTreeSitterAssetScope.run(
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
      await EvidenceTreeSitterAssetScope.run({ cacheDirectory }, async () => {
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
