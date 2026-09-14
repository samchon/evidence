import {
  EvidenceAccessor,
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceSqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves UTF-16 comment attachment, inert examples, withdrawal, and literal qualified addresses. */
export async function test_sql_hosts(): Promise<void> {
  const source = dedent`
    /* ?? ??
     * @evidence docs/spec.md#table Documents the literal table.
     * \`\`\`sql
     * @evidence docs/spec.md#fence An inert example.
     * \`\`\`
     * <pre>@evidence docs/spec.md#html An inert example.</pre>
     */
    CREATE TABLE "schema.dot"."Table Name" (
      -- ?? ??
      -- @evidenceReview docs/spec.md#column This is only a review.
      "literal.column" INTEGER REFERENCES parent(id),
      -- @hidden Retired declared column.
      old INTEGER,
      value VARCHAR(100) DEFAULT '@evidence docs/spec.md#string This is inert.'
    );
    -- @internal Entire retired model.
    CREATE TABLE retired (id INTEGER);
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceSqlAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", source),
  );
  TestValidator.equals(
    "complete literal qualified schema",
    inventory.complete,
    true,
  );
  TestValidator.equals(
    "only real documentation evidence",
    inventory.declarations.map((entry) => entry.target),
    ["docs/spec.md#table"],
  );
  TestValidator.equals(
    "inline relation shares its column review host",
    inventory.reviews.length,
    1,
  );
  const declaration = inventory.declarations[0];
  TestValidator.equals(
    "original UTF-16 tag offset",
    declaration?.location.range?.start.offset,
    source.indexOf("@evidence docs/spec.md#table"),
  );
  TestValidator.predicate(
    "literal dotted segments survive",
    inventory.addresses.some(
      (address) =>
        EvidenceAccessor.format(address.segments) ===
        '["schema.dot"]["Table Name"]["literal.column"]',
    ),
  );
  const hidden = inventory.units
    .filter((unit) => unit.withdrawals.length !== 0)
    .map((unit) => unit.name)
    .sort();
  TestValidator.equals("withdrawal metadata retained", hidden, [
    "OLD",
    "RETIRED",
  ]);
  const retired = inventory.units.filter(
    (unit) => unit.identity[0] === "RETIRED",
  );
  TestValidator.predicate(
    "retired descendants have no eligible hosts",
    inventory.hosts.every((host) =>
      host.unitIds.every((id) => !retired.some((unit) => unit.id === id)),
    ),
  );
  const original = inventory.units.find((unit) => unit.symbol === "model");
  const updated = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      source.replace(
        "Documents the literal table.",
        "Explains the literal table differently.",
      ),
    ),
  );
  if (original === undefined) throw new Error("Missing model.");
  TestValidator.equals(
    "annotation reason leaves model fingerprint stable",
    EvidenceFingerprint.inspect(inventory, original.id).fingerprint,
    EvidenceFingerprint.inspect(updated, original.id).fingerprint,
  );

  const aliasSnapshot = TestSourceSnapshot.create(
    "schema.sql",
    "CREATE TABLE account (id INTEGER);",
  );
  const file = aliasSnapshot.files[0];
  const address = file?.addresses[0];
  if (file === undefined || address === undefined)
    throw new Error("Missing alias source.");
  file.addresses.push({
    ...address,
    absolute: address.absolute.replace("schema.sql", "alias.sql"),
    relative: "alias.sql",
  });
  const aliases = await adapter.analyze(aliasSnapshot);
  const model = aliases.units.find((unit) => unit.symbol === "model");
  if (model === undefined) throw new Error("Missing alias model.");
  const index = new EvidenceInventory([aliases]);
  for (const origin of file.addresses)
    TestValidator.equals(
      "logical file aliases resolve one schema identity",
      index.resolve({ file: origin.absolute, segments: ["ACCOUNT"] }, [
        model.id,
      ]).status,
      "resolved",
    );
}
