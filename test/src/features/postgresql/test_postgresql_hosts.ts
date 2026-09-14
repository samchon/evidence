import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidencePostgresqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Maps SQL documentation and COMMENT strings while retaining withdrawals and semantic fingerprints. */
export async function test_postgresql_hosts(): Promise<void> {
  const source = dedent`
    -- Documentation 🐘
    -- @evidence spec.md#table Describes the table.
    CREATE TABLE app.Item (
      /* @evidence spec.md#id Describes the identifier. */
      id integer PRIMARY KEY,
      value text DEFAULT '@evidence spec.md#string Inert value.'
    );
    COMMENT ON COLUMN app.Item.value IS 'Unicode 🐘 and it''s mapped.
    @evidence spec.md#value Describes the value.';
    -- @internal Hidden schema table.
    CREATE TABLE app.Hidden (secret integer);
    /*
     * Examples:
     * ~~~sql
     * @evidence spec.md#example Inert example.
     * ~~~
     */
    CREATE TABLE app.Example (id integer);
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidencePostgresqlAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", source),
  );

  TestValidator.equals(
    "documentation extraction complete",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "strings and fences remain inert",
    inventory.declarations.map((item) => item.target).sort(),
    ["spec.md#id", "spec.md#table", "spec.md#value"],
  );
  for (const declaration of inventory.declarations)
    TestValidator.equals(
      "original UTF-16 annotation position",
      declaration.location.range?.start.offset,
      source.indexOf(`@evidence ${declaration.target}`),
    );
  TestValidator.equals(
    "withdrawn descendant target",
    new EvidenceInventory([inventory]).resolve(
      { file: "/project/schema.sql", segments: ["app", "hidden", "secret"] },
      inventory.units.map((unit) => unit.id),
    ).status,
    "hidden",
  );
  const table = inventory.units.find(
    (unit) => unit.symbol === "model" && unit.name === "item",
  );
  if (table === undefined) throw new Error("Missing table.");
  const rewritten = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      source.replace("Describes the value.", "Explains the same value."),
    ),
  );
  TestValidator.equals(
    "annotation-only COMMENT edit preserves review",
    EvidenceFingerprint.inspect(inventory, table.id).fingerprint,
    EvidenceFingerprint.inspect(rewritten, table.id).fingerprint,
  );
  const changed = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      source.replace("id integer", "id bigint"),
    ),
  );
  TestValidator.notEquals(
    "column type edit invalidates table review",
    EvidenceFingerprint.inspect(inventory, table.id).fingerprint,
    EvidenceFingerprint.inspect(changed, table.id).fingerprint,
  );
  const unattached = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      "CREATE TABLE app.Item (id integer);\n-- @evidence spec.md#lost No owner.\n",
    ),
  );
  TestValidator.equals(
    "unattached comment cannot acknowledge",
    unattached.declarations,
    [],
  );
  TestValidator.predicate(
    "unattached comment diagnosed",
    unattached.diagnostics.some(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ),
  );
}
