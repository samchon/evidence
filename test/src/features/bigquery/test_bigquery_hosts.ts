import {
  EvidenceBigQueryAdapter,
  EvidenceFingerprint,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Separates attached descriptions from inert values and preserves escaped Unicode tag positions. */
export async function test_bigquery_hosts(): Promise<void> {
  const adapter = new EvidenceBigQueryAdapter();
  const content = dedent`
    -- Orders schema
    -- @evidence ./spec.ts#contract Documents the table.
    CREATE TABLE ds.orders (
      id INT64 OPTIONS(description="😀\\n@evidence ./spec.ts#contract Documents the identifier."),
      inert STRING DEFAULT '@evidence ./spec.ts#contract This is a default value.',
      sample STRING OPTIONS(description='Example:\\n\`\`\`sql\\n@evidence ./spec.ts#contract Inert example.\\n\`\`\`'),
      /* @hidden */
      secret STRING
    );
  `.replaceAll("\n", "\r\n");
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", content),
  );

  TestValidator.equals("description extraction", inventory.diagnostics, []);
  TestValidator.equals(
    "only owned prose creates acknowledgements",
    inventory.declarations.map((declaration) => declaration.reason).sort(),
    ["Documents the identifier.", "Documents the table."].sort(),
  );
  const description = inventory.declarations.find(
    (declaration) => declaration.reason === "Documents the identifier.",
  );
  if (description?.location.range === undefined)
    throw new Error("Missing mapped description location.");
  TestValidator.equals(
    "original UTF-16 tag start",
    description.location.range.start.offset,
    content.indexOf("@evidence", content.indexOf("😀")),
  );
  TestValidator.equals(
    "withdrawn field retains metadata",
    inventory.units
      .find((unit) => unit.name === "secret")
      ?.withdrawals.map((withdrawal) => withdrawal.tag),
    ["hidden"],
  );
  TestValidator.equals(
    "withdrawn field has no selected host",
    inventory.hosts
      .filter((host) => host.attachment === "attached")
      .some((host) =>
        host.unitIds.some(
          (id) =>
            inventory.units.find((unit) => unit.id === id)?.name === "secret",
        ),
      ),
    false,
  );

  const baseline = await adapter.analyze(
    TestSourceSnapshot.create(
      "review.sql",
      "CREATE TABLE ds.reviewed (id INT64) OPTIONS(description='Stable prose.');",
    ),
  );
  const model = baseline.units.find((unit) => unit.symbol === "model");
  if (model === undefined) throw new Error("Missing reviewed model.");
  const reviewed = await adapter.analyze(
    TestSourceSnapshot.create(
      "review.sql",
      "CREATE TABLE ds.reviewed (id INT64) OPTIONS(description='Stable prose.\\n@evidenceReview ./spec.ts#contract Reviewed the definition.');",
    ),
  );
  TestValidator.equals(
    "review cannot satisfy evidence",
    reviewed.declarations,
    [],
  );
  TestValidator.equals(
    "review retained independently",
    reviewed.reviews.length,
    1,
  );
  TestValidator.equals(
    "annotation-only description edit preserves review fingerprint",
    EvidenceFingerprint.inspect(reviewed, model.id).fingerprint,
    EvidenceFingerprint.inspect(baseline, model.id).fingerprint,
  );
}
