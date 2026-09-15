import { EvidPostgresqlAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Rejects PostgreSQL schemas whose selected population depends on unresolved context.
 *
 * Search paths, migration state, unsupported syntax, and failed source snapshots must remain incomplete.
 *
 * 1. Analyze each context-dependent or malformed schema.
 * 2. Require incomplete status and actionable diagnostics.
 * 3. Verify wrong extensions and failed sources cannot pass.
 */
export async function test_postgresql_boundaries(): Promise<void> {
  const adapter = new EvidPostgresqlAdapter();
  for (const source of [
    "CREATE TABLE Item (id integer);",
    "CREATE SCHEMA `app`;",
    "SET search_path TO app; CREATE TABLE app.Item (id integer);",
    "CREATE TABLE app.Item AS SELECT 1 AS id;",
    "CREATE TABLE app.Item (LIKE app.Other);",
    "CREATE TABLE app.Item (id integer) INHERITS (app.Other);",
    "CREATE TABLE app.Item PARTITION OF app.Other FOR VALUES IN (1);",
    "CREATE TABLE IF NOT EXISTS app.Item (id integer);",
    "CREATE TEMP TABLE app.Item (id integer);",
    "CREATE TABLE app.Item (id integer AUTO_INCREMENT);",
    "CREATE TABLE app.Item (id integer, KEY (id) REFERENCES app.Other(id));",
    "CREATE TABLE app.Item (id integer, FOREIGN KEY named_key (id) REFERENCES app.Other(id));",
    "CREATE TABLE app.`Item` (id integer);",
    "CREATE TABLE app.Item (id integer REFERENCES Other(id));",
    "ALTER TABLE app.Item DROP COLUMN id;",
    "ALTER TABLE app.Item RENAME TO Renamed;",
    "ALTER TABLE app.Item ADD COLUMN id integer;",
    "COMMENT ON TABLE app.Item IS 'Missing declaration';",
    "CREATE TABLE app.Item (id integer); COMMENT ON TABLE app.Item IS NULL;",
    "CREATE TABLE app.Item (id integer); COMMENT ON TABLE app.Item IS 'One'; COMMENT ON TABLE app.Item IS 'Two';",
    `CREATE TABLE app."${"a".repeat(64)}" (id integer);`,
    'CREATE TABLE app."a""b" (id integer);',
    "CREATE TABLE app.Item (id integer); CREATE TABLE app.Item (id text);",
    "CREATE TABLE app.Item (id integer",
  ]) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create("schema.sql", source),
    );
    TestValidator.equals(`incomplete: ${source}`, inventory.complete, false);
    TestValidator.predicate(
      "actionable failure",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length !== 0,
      ),
    );
  }
  const wrongExtension = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "schema.ts",
      "CREATE TABLE app.Item (id integer);",
    ),
  );
  TestValidator.equals(
    "dialect does not come from parse success",
    wrongExtension.complete,
    false,
  );
  for (const source of [
    'CREATE SCHEMA "App"; CREATE TABLE "App"."Item" ("LIKE" integer);',
    `CREATE TABLE app."${"a".repeat(63)}" (id integer);`,
  ])
    TestValidator.equals(
      "quoted keyword and maximum-length identifier remain declarations",
      (await adapter.analyze(EvidTestSourceSnapshot.create("valid.sql", source)))
        .diagnostics,
      [],
    );
  const failed = EvidTestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE app.Item (id integer);",
  );
  failed.complete = false;
  failed.diagnostics.push({
    code: "path-unreadable",
    path: "/project/missing.sql",
    message: "Cannot read selected schema.",
  });
  TestValidator.equals(
    "source failure remains incomplete",
    (await adapter.analyze(failed)).complete,
    false,
  );
}
