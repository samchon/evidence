import { EvidenceBigQueryAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Keeps unsupported and malformed GoogleSQL from producing a smaller passing
 * population.
 *
 * BigQuery analysis must preserve failure information whenever static
 * extraction cannot establish an authoritative schema surface.
 *
 * 1. Analyze unsupported table forms, conflicting declarations, invalid keys and
 *    types, dynamic options, and malformed syntax.
 * 2. Require every case to be incomplete with an error diagnostic that provides a
 *    repair.
 * 3. Retain an unreadable-source failure and exclude a temporary table while
 *    retaining the persistent table and column.
 */
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
    "CREATE TABLE ds.orders (`display.name` STRING);",
    "CREATE TABLE ds.orders (details STRUCT<id INT64 PRIMARY KEY NOT ENFORCED>);",
    "CREATE TABLE ds.orders (id INT64, CONSTRAINT `escaped\\u0061` FOREIGN KEY (id) REFERENCES ds.other (id) NOT ENFORCED);",
    "CREATE TABLE ds.orders (id INT64, FOREIGN KEY (id) REFERENCES ds.other (id, extra) NOT ENFORCED);",
    "CREATE TABLE ds.orders (id INT64) OPTIONS(description=CONCAT('dynamic', ' value'));",
    "CREATE TABLE ds.orders (id INT64",
    "CREATE TABLE ds.orders (id INT64); CREATE TABLE ds.orders (id STRING);",
  ]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", content),
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
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      dedent`
    CREATE TEMP TABLE scratch (id INT64);
    CREATE TABLE ds.orders (id INT64);
  `,
    ),
  );
  TestValidator.equals(
    "temporary schema is not published",
    temporary.units
      .map((unit) => unit.identity.join("."))
      .sort((left, right) => left.localeCompare(right, "en")),
    ["ds.orders", "ds.orders.id"],
  );
}
