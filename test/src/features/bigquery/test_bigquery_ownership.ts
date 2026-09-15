import { EvidBigQueryAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves BigQuery ownership for literal paths, endpoint keys, and nested withdrawals.
 *
 * The inventory must distinguish declaration identity from syntax that merely resembles a table or member name.
 *
 * 1. Analyze qualified and quoted table paths with nested fields and inline keys.
 * 2. Verify anonymous relation endpoints and key units attach to their declaring model.
 * 3. Require a withdrawn nested member to remain excluded from the selected hierarchy.
 */
export async function test_bigquery_ownership(): Promise<void> {
  const adapter = new EvidBigQueryAdapter();
  const first = "FOREIGN KEY (ID) REFERENCES ds.Parent (id) NOT ENFORCED";
  const second = "FOREIGN KEY (id) REFERENCES ds.parent (id) NOT ENFORCED";
  const source = dedent`
    CREATE TABLE ds.orders (
      ID INT64,
      \`display name\` STRING,
      /* @hidden */
      secret STRUCT<leaf STRING, repeated ARRAY<STRUCT<value STRING>>>,
      ${first},
      ${second}
    );
  `;
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", source),
  );
  TestValidator.equals(
    "valid ownership declarations",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "quoted flexible field remains literal",
    inventory.units.find((unit) => unit.name === "display name")?.identity,
    ["ds", "orders", "display name"],
  );
  const relations = inventory.units.filter(
    (unit) => unit.symbol === "relation",
  );
  TestValidator.equals(
    "case-sensitive referenced tables remain distinct",
    relations.length,
    2,
  );
  TestValidator.equals(
    "case-insensitive field identity",
    inventory.units.find((unit) => unit.name === "ID")?.identity,
    ["ds", "orders", "id"],
  );
  TestValidator.equals(
    "nested withdrawal propagates to every field",
    inventory.units
      .filter((unit) => unit.identity[2] === "secret")
      .map((unit) => unit.withdrawals.map((withdrawal) => withdrawal.tag)),
    [["hidden"], ["hidden"], ["hidden"], ["hidden"]],
  );

  const reorderedSource = source.replace(
    `${first},\n  ${second}`,
    `${second},\n  ${first}`,
  );
  TestValidator.notEquals(
    "constraint order actually changes",
    reorderedSource,
    source,
  );
  const reordered = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", reorderedSource),
  );
  TestValidator.equals(
    "anonymous key identities ignore declaration order",
    reordered.units
      .filter((unit) => unit.symbol === "relation")
      .map((unit) => unit.id)
      .sort((left, right) => left.localeCompare(right, "en")),
    relations
      .map((unit) => unit.id)
      .sort((left, right) => left.localeCompare(right, "en")),
  );

  const inline = await adapter.analyze(
    TestSourceSnapshot.create(
      "inline.sql",
      dedent`
    CREATE TABLE ds.inline_key (
      /* @evid ./spec.ts#contract Documents the field and its declared key. */
      id INT64 REFERENCES ds.parent (id) NOT ENFORCED
    );
  `,
    ),
  );
  TestValidator.equals(
    "inline declaration remains complete",
    inline.diagnostics,
    [],
  );
  const inlineHost = inline.hosts.find((host) => host.unitIds.length === 2);
  if (inlineHost === undefined)
    throw new Error("Missing inline relation host.");
  TestValidator.equals(
    "inline relation and column share one physical host",
    inlineHost.unitIds.length,
    2,
  );
  TestValidator.equals(
    "one source annotation stays one acknowledgement",
    inline.declarations.length,
    1,
  );
}
