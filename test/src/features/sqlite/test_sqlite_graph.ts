import {
  EvidAccessor,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidSqliteAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates SQLite selectors as claim and reference populations.
 *
 * Graph role affects obligation ownership, while reviews are retained separately and cannot supply evidence coverage.
 *
 * 1. Extract schema and claims for every SQLite selector.
 * 2. Evaluate covered and missing populations in both roles.
 * 3. Verify review-only resolutions leave coverage missing.
 */
export async function test_sqlite_graph(): Promise<void> {
  const schema = await new EvidSqliteAdapter().analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      dedent`
    -- @evid docs.md#model Implements the model.
    CREATE TABLE Account (
      -- @evid docs.md#column Implements the column.
      owner INTEGER,
      -- @evid docs.md#relation Implements the relation.
      CONSTRAINT owner_link FOREIGN KEY (owner) REFERENCES Owners(id)
    );
  `,
    ),
  );
  const markdown = await new EvidMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs.md",
      "## model\n\n## column\n\n## relation\n",
    ),
  );
  TestValidator.equals("schema extraction is complete", schema.diagnostics, []);

  for (const symbol of ["model", "column", "relation"] as const) {
    const units = schema.units.filter((unit) => unit.symbol === symbol);
    const unitIds = units.map((unit) => unit.id);
    const target = schema.addresses.find(
      (address) => address.unitId === units[0]?.id,
    );
    if (target === undefined) throw new Error(`Missing ${symbol} address.`);
    const claim = await new EvidTypeScriptAdapter().analyze(
      TestSourceSnapshot.create(
        "claim.ts",
        `/** @evid ./schema.sql#${EvidAccessor.format(target.segments)} Verifies this database declaration. */\nexport function verify() {}\n`,
      ),
    );

    for (const positive of [true, false]) {
      // SQLite is a reference; every undocumented selected declaration remains obligatory.
      const source = structuredClone(claim);
      if (!positive) source.declarations = [];
      const graph = EvidGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: source,
            unitIds: source.units.map((unit) => unit.id),
            references: [
              {
                severity: "error",
                inventory: schema,
                unitIds,
                resolutions: await TestGraph.resolveDeclarations(
                  source,
                  schema,
                  unitIds,
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${symbol} reference coverage ${positive}`,
        graph.success,
        positive,
      );
      TestValidator.equals(
        `${symbol} exact reference denominator`,
        TestGraph.obligation(graph, 0, 0).missingUnitIds,
        positive ? [] : unitIds,
      );

      // SQLite is a claim; a declaration's selector owns its own attached acknowledgement.
      const database = structuredClone(schema);
      database.declarations = positive
        ? database.declarations.filter(
            (declaration) => declaration.target === `docs.md#${symbol}`,
          )
        : [];
      const referenceIds = markdown.units
        .filter((unit) => unit.identity.at(-1) === symbol)
        .map((unit) => unit.id);
      const reverse = EvidGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: database,
            unitIds,
            references: [
              {
                severity: "error",
                inventory: markdown,
                unitIds: referenceIds,
                resolutions: await TestGraph.resolveDeclarations(
                  database,
                  markdown,
                  referenceIds,
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${symbol} claim coverage ${positive}`,
        reverse.success,
        positive,
      );
      TestValidator.equals(
        `${symbol} exact claim denominator`,
        TestGraph.obligation(reverse, 0, 0).missingUnitIds,
        positive ? [] : referenceIds,
      );
    }
  }

  const review = await new EvidSqliteAdapter().analyze(
    TestSourceSnapshot.create(
      "review.sql",
      "-- @evidReview ./schema.sql#Account Reviewed without evidence.\nCREATE TABLE Reviewed (id INTEGER);",
    ),
  );
  TestValidator.equals(
    "review does not create declarations",
    review.declarations,
    [],
  );
  TestValidator.equals(
    "review is retained independently",
    review.reviews.length,
    1,
  );
  const selected = schema.units
    .filter((unit) => unit.symbol === "model")
    .map((unit) => unit.id);
  const graph = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: review,
        unitIds: review.units.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: schema,
            unitIds: selected,
            resolutions: [],
            reviewResolutions: await TestGraph.resolveReviews(
              review,
              schema,
              selected,
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals(
    "review leaves ordinary coverage missing",
    TestGraph.obligation(graph, 0, 0).missingUnitIds,
    selected,
  );
}
