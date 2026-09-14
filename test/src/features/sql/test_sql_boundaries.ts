import { EvidenceSqlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents the broad grammar from silently accepting dialect or schema-changing constructs as portable SQL. */
export async function test_sql_boundaries(): Promise<void> {
  const adapter = new EvidenceSqlAdapter();
  for (const content of [
    "CREATE TABLE account (id INTEGER DEFAULT nextval('sequence'));",
    "CREATE TABLE account (id INTEGER, UNIQUE INDEX named (id));",
    "CREATE TABLE account (id INTEGER, UNIQUE KEY (id));",
    "ALTER TABLE account ADD COLUMN extra INTEGER;",
    "DROP TABLE account;",
    "CREATE TABLE account AS SELECT id FROM source;",
    "CREATE TEMPORARY TABLE account (id INTEGER);",
    "CREATE TABLE IF NOT EXISTS account (id INTEGER);",
    "CREATE VIEW account AS SELECT id FROM source;",
    "CREATE TABLE account (id INTEGER[]);",
    "CREATE TABLE account (id SERIAL);",
    "CREATE TABLE account (id INTEGER AUTO_INCREMENT);",
    "CREATE TABLE `account` (id INTEGER);",
    "CREATE TABLE account (id INTEGER, FOREIGN KEY (absent) REFERENCES remote(id));",
    "CREATE TABLE account (id INTEGER, FOREIGN KEY (id) REFERENCES remote(first, second));",
    "CREATE TABLE account (id INTEGER); CREATE TABLE account (other INTEGER);",
    "CREATE TABLE account (id INTEGER, ID INTEGER);",
  ]) {
    const result = await adapter.analyze(
      TestSourceSnapshot.create("schema.sql", content),
    );
    TestValidator.equals(`incomplete: ${content}`, result.complete, false);
    TestValidator.predicate(
      "actionable failure",
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length !== 0,
      ),
    );
  }
  const defaults = await adapter.analyze(
    TestSourceSnapshot.create(
      "defaults.sql",
      "CREATE TABLE defaults (negative INTEGER DEFAULT -1, enabled BOOLEAN DEFAULT TRUE, label VARCHAR(10) DEFAULT 'ok', created TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
    ),
  );
  TestValidator.equals(
    "portable scalar defaults preserve every column",
    defaults.complete,
    true,
  );
  TestValidator.equals(
    "explicit defaulted columns",
    defaults.units
      .filter((unit) => unit.symbol === "column")
      .map((unit) => unit.name)
      .sort((left, right) => left.localeCompare(right, "en")),
    ["CREATED", "ENABLED", "LABEL", "NEGATIVE"],
  );
  const empty = await adapter.analyze(
    TestSourceSnapshot.create("empty.sql", "-- An explicitly empty schema.\n"),
  );
  TestValidator.equals("empty understood schema", empty.complete, true);
  TestValidator.equals("no fabricated units", empty.units, []);
}
