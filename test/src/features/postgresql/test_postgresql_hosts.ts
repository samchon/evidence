import { EvidenceFingerprint, EvidenceInventory, EvidencePostgresqlAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Maps PostgreSQL documentation strings to their schema hosts.
 *
 * COMMENT annotations, withdrawals, and fingerprints have distinct effects,
 * while unrelated strings cannot acknowledge a unit.
 *
 * 1. Analyze documented schema units, withdrawals, and inert text.
 * 2. Verify targets, resolution, and withdrawal metadata.
 * 3. Compare fingerprints after documentation and semantic edits.
 */
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
    EvidenceTestSourceSnapshot.create("schema.sql", source),
  );

  TestValidator.equals(
    "documentation extraction complete",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "strings and fences remain inert",
    inventory.declarations
      .map((item) => item.target)
      .sort((a, b) => a.localeCompare(b, "en")),
    ["spec.md#id", "spec.md#table", "spec.md#value"],
  );
  for (const declaration of inventory.declarations) {
    const range = declaration.location.range;
    if (range === undefined) throw new Error("Missing annotation location.");
    TestValidator.equals(
      "original UTF-16 annotation position",
      range.start.offset,
      source.indexOf(`@evidence ${declaration.target}`),
    );
  }
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
    EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      source.replace("id integer", "id bigint"),
    ),
  );
  TestValidator.notEquals(
    "column type edit invalidates table review",
    EvidenceFingerprint.inspect(inventory, table.id).fingerprint,
    EvidenceFingerprint.inspect(changed, table.id).fingerprint,
  );
  const plain = "CREATE TABLE app.Item (id integer);";
  const withoutComment = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("comment.sql", plain),
  );
  const withComment = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "comment.sql",
      `${plain}\nCOMMENT ON TABLE app.Item IS '@evidenceReview spec.md#table Review metadata only.';`,
    ),
  );
  TestValidator.equals(
    "adding COMMENT documentation preserves table fingerprint",
    EvidenceFingerprint.inspect(withoutComment, table.id).fingerprint,
    EvidenceFingerprint.inspect(withComment, table.id).fingerprint,
  );
  TestValidator.equals(
    "COMMENT review never acknowledges",
    withComment.declarations,
    [],
  );
  TestValidator.equals(
    "COMMENT review retains its eligible host",
    withComment.reviews.length,
    1,
  );
  const trailing = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "trailing.sql",
      "CREATE TABLE app.Item (id integer); -- @evidence spec.md#trailing No next owner.\nCREATE TABLE app.Other (id integer);",
    ),
  );
  TestValidator.equals(
    "trailing comment does not move to following table",
    trailing.declarations,
    [],
  );
  const leading = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "leading.sql",
      "CREATE TABLE app.Item (id integer); -- A trailing comment.\n-- @evidence spec.md#leading Documents the next table.\nCREATE TABLE app.Other (id integer);",
    ),
  );
  TestValidator.equals(
    "trailing prose does not consume the following documentation run",
    leading.declarations.map((declaration) => declaration.target),
    ["spec.md#leading"],
  );
  const separated = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "separated.sql",
      "-- @evidence spec.md#separated No adjacent owner.\n\nCREATE TABLE app.Item (id integer);",
    ),
  );
  TestValidator.equals(
    "blank lines detach documentation",
    separated.declarations,
    [],
  );
  const unattached = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
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
