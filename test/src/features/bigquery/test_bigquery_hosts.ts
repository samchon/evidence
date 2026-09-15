import {
  EvidBigQueryAdapter,
  EvidFingerprint,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches BigQuery description evidence while preserving source coordinates and inert carriers.
 *
 * SQL descriptions are eligible hosts, whereas defaults, fenced examples, and review annotations must not become acknowledgements.
 *
 * 1. Extract table and column description tags from CRLF source containing Unicode and compare their reasons.
 * 2. Verify the description tag's original UTF-16 offset, line, and column, then retain a hidden field without an attached host.
 * 3. Keep review annotations separate from declarations and preserve the model fingerprint across an annotation-only edit.
 */
export async function test_bigquery_hosts(): Promise<void> {
  const adapter = new EvidBigQueryAdapter();
  const content = dedent`
    -- Orders schema
    -- @evid ./spec.ts#contract Documents the table.
    CREATE TABLE ds.orders (
      id INT64 OPTIONS(description="😀\\n@evid ./spec.ts#contract Documents the identifier."),
      inert STRING DEFAULT '@evid ./spec.ts#contract This is a default value.',
      sample STRING OPTIONS(description='Example:\\n\`\`\`sql\\n@evid ./spec.ts#contract Inert example.\\n\`\`\`'),
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
    inventory.declarations
      .map((declaration) => declaration.reason)
      .sort((left, right) => left.localeCompare(right, "en")),
    ["Documents the identifier.", "Documents the table."].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
  );
  const description = inventory.declarations.find(
    (declaration) => declaration.reason === "Documents the identifier.",
  );
  if (description === undefined || description.location.range === undefined)
    throw new Error("Missing mapped description location.");
  TestValidator.equals(
    "original UTF-16 tag start",
    description.location.range.start.offset,
    content.indexOf("@evid", content.indexOf("😀")),
  );
  TestValidator.equals(
    "CRLF keeps the original description line",
    description.location.range.start.line,
    4,
  );
  TestValidator.equals(
    "Unicode uses original UTF-16 columns",
    description.location.range.start.column,
    description.location.range.start.offset -
      content.lastIndexOf("\n", description.location.range.start.offset),
  );
  const secret = inventory.units.find((unit) => unit.name === "secret");
  if (secret === undefined) throw new Error("Missing secret field.");
  TestValidator.equals(
    "withdrawn field retains metadata",
    secret.withdrawals.map((withdrawal) => withdrawal.tag),
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
      "CREATE TABLE ds.reviewed (id INT64) OPTIONS(description='Stable prose.\\n@evidReview ./spec.ts#contract Reviewed the definition.');",
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
    EvidFingerprint.inspect(reviewed, model.id).fingerprint,
    EvidFingerprint.inspect(baseline, model.id).fingerprint,
  );

  const trailing = await adapter.analyze(
    TestSourceSnapshot.create(
      "trailing.sql",
      dedent`
    CREATE TABLE ds.trailing (
      id INT64, -- @hidden This trailing note must not withdraw the next field.
      -- @evid ./spec.ts#contract Documents only the next field.
      next STRING
    );
  `,
    ),
  );
  const next = trailing.units.find((unit) => unit.name === "next");
  if (next === undefined) throw new Error("Missing following field.");
  TestValidator.equals(
    "trailing withdrawal remains detached",
    next.withdrawals,
    [],
  );
  TestValidator.equals(
    "following documentation run remains independent",
    trailing.declarations.map((declaration) => declaration.reason),
    ["Documents only the next field."],
  );
}
