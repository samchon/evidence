import { EvidenceBigQueryAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents unsupported, state-dependent, malformed, or inaccessible schemas from shrinking coverage. */
export async function test_bigquery_failures(): Promise<void> {
  const adapter = new EvidenceBigQueryAdapter();
  for (const content of [
    "CREATE TABLE ds.result AS SELECT 1 AS id;",
    "CREATE VIEW ds.result AS SELECT 1 AS id;",
    "CREATE EXTERNAL TABLE ds.external OPTIONS(format='CSV', uris=['gs://bucket/*.csv']);",
    "CREATE TABLE ds.copy LIKE ds.original;",
    "CREATE TABLE ds.clone CLONE ds.original;",
    "ALTER TABLE ds.orders ADD COLUMN price NUMERIC;",
    "CREATE OR REPLACE TABLE ds.orders (id INT64);",
    "CREATE TABLE IF NOT EXISTS ds.orders (id INT64);",
    "CREATE TABLE ds.orders (id INT64, PRIMARY KEY (id) ENFORCED);",
    "CREATE TABLE ds.orders (id INT64, PRIMARY KEY (missing) NOT ENFORCED);",
    "CREATE TABLE ds.orders (id INT64, ID STRING);",
    "CREATE TABLE ds.orders (id INT64 PRIMARY KEY NOT ENFORCED, PRIMARY KEY (id) NOT ENFORCED);",
    "CREATE TABLE ds.orders (items ARRAY<UnknownType>);",
    "CREATE TABLE ds.orders (id INT64, CONSTRAINT `escaped\\u0061` FOREIGN KEY (id) REFERENCES ds.other (id) NOT ENFORCED);",
    "CREATE TABLE ds.orders (id INT64, FOREIGN KEY (id) REFERENCES ds.other (id, extra) NOT ENFORCED);",
    "CREATE TABLE ds.orders (id INT64) OPTIONS(description=CONCAT('dynamic', ' value'));",
    "CREATE TABLE ds.orders (id INT64",
    "CREATE TABLE ds.orders (id INT64); CREATE TABLE ds.orders (id STRING);",
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create("schema.sql", content),
    );
    TestValidator.equals(
      `incomplete source: ${content}`,
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "actionable failure",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length > 0,
      ),
    );
  }
  const failed = await adapter.analyze(
    TestSourceSnapshot.fail(
      TestSourceSnapshot.create(
        "schema.sql",
        "CREATE TABLE ds.orders (id INT64);",
      ),
      {
        code: "path-unreadable",
        path: "/project/schema.sql",
        message: "Cannot read selected schema.",
      },
    ),
  );
  TestValidator.equals(
    "source failure remains incomplete",
    failed.complete,
    false,
  );
  TestValidator.predicate(
    "source failure retained",
    failed.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("Cannot read"),
    ),
  );

  const temporary = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      dedent`
    CREATE TEMP TABLE scratch (id INT64);
    CREATE TABLE ds.orders (id INT64);
  `,
    ),
  );
  TestValidator.equals(
    "temporary schema is not published",
    temporary.units.map((unit) => unit.identity),
    [
      ["ds", "orders"],
      ["ds", "orders", "id"],
    ],
  );
}
