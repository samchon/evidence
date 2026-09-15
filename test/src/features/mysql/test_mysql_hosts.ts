import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceMysqlAdapter,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Attaches MySQL COMMENT annotations to their owning schema units.
 *
 * Documentation strings can acknowledge a declaration, while SQL examples and
 * strings remain inert; withdrawals and fingerprints retain their separate
 * semantics.
 *
 * 1. Analyze documented tables, columns, reviews, withdrawals, and inert
 *    comment-shaped text.
 * 2. Verify attachment, CRLF coordinates, target resolution, and withdrawal
 *    metadata.
 * 3. Compare review fingerprints after annotation and semantic edits.
 * 4. Require ambiguous schema input to remain incomplete.
 */
export async function test_mysql_hosts(): Promise<void> {
  const source = dedent`
    /* Unicode 계약 😀 */
    CREATE TABLE Contract (
      id INT COMMENT '@evidence ./spec.md#column Verifies the column.',
      note TEXT DEFAULT '@evidence ./spec.md#string Inert default value.',
      /** @internal Retired field. */
      retired INT,
      /** @evidenceReview ./spec.md#relation Reviewed without evidence. */
      FOREIGN KEY parent_fk (id) REFERENCES Parent (id)
    ) COMMENT='@evidence ./spec.md#model Verifies the model.';
    /**
     * Examples:
     * ~~~sql
     * @evidence ./spec.md#example Inert fenced example.
     * ~~~
     */
    CREATE TABLE Example (id INT);
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceMysqlAdapter();
  const original = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("schema.sql", source),
  );

  TestValidator.equals(
    "complete comment-bearing schema",
    original.diagnostics,
    [],
  );
  TestValidator.equals(
    "only attached COMMENT literals acknowledge",
    original.declarations
      .map((item) => item.target)
      .sort((left, right) => left.localeCompare(right)),
    ["./spec.md#column", "./spec.md#model"],
  );
  TestValidator.equals("review stays separate", original.reviews.length, 1);
  const tag = original.declarations.find((item) =>
    item.target.endsWith("#column"),
  );
  if (tag === undefined || tag.location.range === undefined)
    throw new Error("Missing column annotation range.");
  TestValidator.equals(
    "UTF-16 offsets after astral Unicode",
    tag.location.range.start.offset,
    source.indexOf("@evidence ./spec.md#column"),
  );
  TestValidator.equals("CRLF line mapping", tag.location.range.start.line, 3);
  const selected = original.units.map((unit) => unit.id);
  TestValidator.equals(
    "withdrawn column remains diagnosed as hidden",
    new EvidenceInventory([original]).resolve(
      { file: "/project/schema.sql", segments: ["Contract", "retired"] },
      selected,
    ).status,
    "hidden",
  );
  const model = original.units.find((unit) => unit.name === "Contract");
  if (model === undefined) throw new Error("Missing Contract model.");
  const annotated = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      source.replace(
        "Verifies the column.",
        "Records the same column differently.",
      ),
    ),
  );
  TestValidator.equals(
    "COMMENT annotation edits preserve ancestor review",
    EvidenceFingerprint.inspect(original, model.id).fingerprint,
    EvidenceFingerprint.inspect(annotated, model.id).fingerprint,
  );
  const changed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "schema.sql",
      source.replace("id INT COMMENT", "id BIGINT COMMENT"),
    ),
  );
  TestValidator.notEquals(
    "column type edit invalidates ancestor review",
    EvidenceFingerprint.inspect(original, model.id).fingerprint,
    EvidenceFingerprint.inspect(changed, model.id).fingerprint,
  );
  const escaped = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "escaped.sql",
      "CREATE TABLE Escaped (id INT COMMENT 'Owner''s note.\n@evidence ./spec.md#escaped Verifies escaped prose.');",
    ),
  );
  TestValidator.equals(
    "doubled apostrophe decoding retains tags",
    escaped.declarations.map((item) => item.target),
    ["./spec.md#escaped"],
  );
  const ambiguous = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "one.sql",
        "CREATE TABLE Same (id INT);",
      ),
      EvidenceTestSourceSnapshot.create(
        "two.sql",
        "CREATE TABLE Same (other INT);",
      ),
    ]),
  );
  TestValidator.equals(
    "conflicting schemas never silently merge",
    ambiguous.complete,
    false,
  );
}
