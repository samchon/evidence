import { EvidenceSqliteAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects SQLite input that changes schema interpretation or relation
 * certainty.
 *
 * Execution-dependent statements and invalid foreign keys must keep the
 * inventory incomplete rather than silently remove obligations.
 *
 * 1. Analyze each schema-changing or invalid relation form.
 * 2. Require incomplete status with actionable diagnostics.
 * 3. Verify supported empty input has no fabricated units.
 */
export async function test_sqlite_boundaries(): Promise<void> {
  for (const statement of [
    "CREATE VIRTUAL TABLE search USING fts5(title, body);",
    "CREATE TABLE derived AS SELECT 1 AS id;",
    "ATTACH DATABASE 'other.db' AS other;",
    "DETACH DATABASE other;",
    "ALTER TABLE valid ADD COLUMN unseen TEXT;",
    "DROP TABLE valid;",
    "PRAGMA writable_schema = ON;",
    "CREATE VIEW derived AS SELECT id FROM valid;",
    "EXPLAIN CREATE TABLE preview (id INTEGER);",
    "CREATE TEMP TABLE main.conflict (id INTEGER);",
    "CREATE TABLE sqlite_internal (id INTEGER);",
    "CREATE TABLE broken (id INTEGER, FOREIGN KEY (missing) REFERENCES other(id));",
    "CREATE TABLE broken (id INTEGER, FOREIGN KEY (id) REFERENCES other(a, b));",
    "CREATE TABLE broken (id INTEGER,",
  ]) {
    const inventory = await new EvidenceSqliteAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "schema.sql",
        `CREATE TABLE valid (id INTEGER);\n${statement}`,
      ),
    );

    TestValidator.equals(
      `incomplete source: ${statement}`,
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "failure includes an actionable diagnostic",
      inventory.diagnostics.some((diagnostic) => diagnostic.repair.length > 0),
    );
  }

  // A declared qualified schema does not require ATTACH execution to inventory its names.
  const qualified = await new EvidenceSqliteAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      "CREATE TABLE archive.items (id INTEGER PRIMARY KEY, owner INTEGER REFERENCES owners MATCH simple ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED);",
    ),
  );
  TestValidator.equals(
    "qualified static schema remains complete",
    qualified.diagnostics,
    [],
  );
  TestValidator.equals(
    "implicit referenced primary key still forms one relation",
    qualified.units.filter((unit) => unit.symbol === "relation").length,
    1,
  );

  const failed = EvidenceTestSourceSnapshot.fail(
    EvidenceTestSourceSnapshot.create("schema.sql", ""),
    {
      code: "path-unreadable",
      message: "Read denied.",
      path: "/project/schema.sql",
    },
  );
  const inventory = await new EvidenceSqliteAdapter().analyze(failed);
  TestValidator.equals(
    "source failure stays incomplete",
    inventory.complete,
    false,
  );
  TestValidator.predicate(
    "source failure retained",
    inventory.diagnostics.some(
      (diagnostic) => diagnostic.code === "source-path-unreadable",
    ),
  );
}
