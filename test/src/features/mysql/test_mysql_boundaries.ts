import { EvidenceMysqlAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects MySQL inputs that could hide part of the selected schema.
 *
 * Dialect changes, migration state, executable comments, invalid names, and
 * source failures must produce incomplete analysis instead of a smaller
 * success.
 *
 * 1. Analyze unsupported and malformed schema variants.
 * 2. Require each result to be incomplete with its boundary diagnostic.
 * 3. Verify failed snapshots and wrong extensions remain incomplete.
 */
export async function test_mysql_boundaries(): Promise<void> {
  const adapter = new EvidenceMysqlAdapter();
  for (const source of [
    "CREATE TABLE broken (id INT;",
    "CREATE TABLE t (id INT); ALTER TABLE t ADD COLUMN added INT;",
    "CREATE TABLE t (id INT); DROP TABLE t;",
    "CREATE TABLE t (id INT); RENAME TABLE t TO changed;",
    "CREATE TABLE t AS SELECT 1 AS id;",
    "CREATE TABLE t LIKE existing;",
    "CREATE TEMPORARY TABLE t (id INT);",
    "CREATE UNLOGGED TABLE t (id INT);",
    "CREATE TABLE db.schema.t (id INT);",
    'CREATE TABLE "ansi" (id INT);',
    "CREATE TABLE `trailing ` (id INT);",
    "CREATE TABLE `😀` (id INT);",
    "CREATE TABLE t (`doubled``quote` INT);",
    "CREATE TABLE t (id SERIAL);",
    "CREATE TABLE t (id INT[]);",
    "CREATE TABLE t (id INT ASC);",
    "CREATE TABLE t (id INT, UNIQUE NULLS DISTINCT (id));",
    "CREATE TABLE t (id INT DEFAULT ARRAY[1]);",
    "CREATE TABLE t (id INT DEFAULT '1'::int);",
    "CREATE TABLE t (id TEXT DEFAULT $$text$$);",
    "--CREATE TABLE hidden (id INT);",
    "CREATE TABLE t (id INT COMMENT 'First' COMMENT 'Second');",
    "CREATE TABLE t (id INT) COMMENT='First' COMMENT='Second';",
    "CREATE TABLE t (ID INT, id INT);",
    "CREATE TABLE t (id INT, FOREIGN KEY (missing) REFERENCES parent (id));",
    "CREATE TABLE t (id INT, FOREIGN KEY (id) REFERENCES parent (id, extra));",
    "CREATE TABLE t (id INT, FOREIGN KEY (id) REFERENCES parent (id), FOREIGN KEY (id) REFERENCES parent (id));",
    "CREATE TABLE t (id INT) INHERITS (parent);",
    "CREATE TABLE t (id INT) ENGINE=Unrecognized;",
    "USE another; CREATE TABLE t (id INT);",
    "SET sql_mode='ANSI_QUOTES'; CREATE TABLE t (id INT);",
    "DELIMITER $$\nCREATE PROCEDURE p() BEGIN CREATE TABLE t (id INT); END$$",
    "PREPARE stmt FROM 'CREATE TABLE t (id INT)'; EXECUTE stmt;",
    "/*! CREATE TABLE hidden (id INT); */",
    "CREATE VIEW projected AS SELECT 1 AS id;",
  ]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", source),
    );

    TestValidator.equals(`incomplete: ${source}`, inventory.complete, false);
    TestValidator.predicate(
      `actionable: ${source}`,
      inventory.diagnostics.some((diagnostic) => diagnostic.repair.length > 0),
    );
  }
  const failed = await adapter.analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create("unreadable.sql", ""),
      {
        code: "path-unreadable",
        path: "/project/unreadable.sql",
        message: "Unavailable schema source.",
      },
    ),
  );
  TestValidator.equals("source failure is retained", failed.complete, false);
  const extension = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.pgsql",
      "CREATE TABLE t (id INT);",
    ),
  );
  TestValidator.equals(
    "configured dialect owns selection",
    extension.complete,
    false,
  );
}
