import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceSqliteAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Attaches SQLite documentation with stable Unicode source coordinates.
 *
 * Eligible comments can acknowledge a table or column, while examples and
 * withdrawn tables remain outside normal evidence coverage.
 *
 * 1. Analyze documented schema units, Unicode comments, examples, and withdrawals.
 * 2. Verify coordinates, target resolution, and withdrawal handling.
 * 3. Compare review fingerprints after annotation and semantic edits.
 */
export async function test_sqlite_hosts(): Promise<void> {
  const source = dedent`
    -- 계약 😀
    -- @evidence docs.md#table Implements the table.
    CREATE TABLE "주문" (
      /** @evidence docs.md#amount Records the amount. */
      amount INTEGER DEFAULT 1,
      text_value TEXT DEFAULT '@evidence docs.md#literal Inert string.'
    );
    /* @internal Withdraws the complete table. */
    CREATE TABLE Retired (child INTEGER);
    /**
     * Examples:
     * ~~~sql
     * @evidence docs.md#example Inert code.
     * ~~~
     *
     *     @evidence docs.md#indented Inert indented code.
     */
    CREATE TABLE Example (id INTEGER);
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceSqliteAdapter();
  const inventory = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("schema.sql", source),
  );

  TestValidator.equals(
    "attached comments only",
    inventory.declarations.map((declaration) => declaration.target),
    ["docs.md#table", "docs.md#amount"],
  );
  TestValidator.equals(
    "valid original Unicode positions",
    inventory.diagnostics,
    [],
  );
  const annotation = inventory.declarations[0];
  if (annotation === undefined || annotation.location.range === undefined)
    throw new Error("Missing SQLite annotation source range.");
  TestValidator.equals(
    "UTF-16 offset after astral comment",
    annotation.location.range.start.offset,
    source.indexOf("@evidence"),
  );
  TestValidator.equals(
    "CRLF line preserved",
    annotation.location.range.start.line,
    2,
  );
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "withdrawn child resolves hidden",
    graph.resolve(
      { file: "/project/schema.sql", segments: ["Retired", "child"] },
      inventory.units.map((unit) => unit.id),
    ).status,
    "hidden",
  );
  const table = inventory.units.find((unit) => unit.name === "주문");
  if (table === undefined) throw new Error("Missing Unicode table.");
  const annotationEdit = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      source.replace("Records the amount.", "Explains the same amount."),
    ),
  );
  const semanticEdit = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      source.replace("DEFAULT 1", "DEFAULT 2"),
    ),
  );
  TestValidator.equals(
    "annotation edit preserves parent fingerprint",
    EvidenceFingerprint.inspect(inventory, table.id).fingerprint,
    EvidenceFingerprint.inspect(annotationEdit, table.id).fingerprint,
  );
  TestValidator.notEquals(
    "column semantic edit invalidates parent fingerprint",
    EvidenceFingerprint.inspect(inventory, table.id).fingerprint,
    EvidenceFingerprint.inspect(semanticEdit, table.id).fingerprint,
  );

  for (const comment of [
    "-- @evidence docs.md#detached Detached comment.\n\nCREATE TABLE Fresh (id INTEGER);",
    "CREATE TABLE Fresh (id INTEGER); -- @evidence docs.md#trailing Trailing comment.",
  ]) {
    const detached = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("detached.sql", comment),
    );
    TestValidator.equals(
      "detached comment has no acknowledgement",
      detached.declarations,
      [],
    );
    TestValidator.equals(
      "detached annotation diagnostic",
      detached.diagnostics.map((diagnostic) => diagnostic.code),
      ["unsupported-annotation-host"],
    );
  }

  const adjacent = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "adjacent.sql",
      dedent`
    CREATE TABLE Fresh (
      id INTEGER, -- ordinary trailing prose
      -- @evidence docs.md#next Documents the next column.
      documented TEXT
    );
  `,
    ),
  );
  TestValidator.equals(
    "trailing prose cannot swallow leading documentation",
    adjacent.declarations.map((declaration) => declaration.target),
    ["docs.md#next"],
  );
  TestValidator.equals(
    "leading documentation remains valid",
    adjacent.diagnostics,
    [],
  );
}
