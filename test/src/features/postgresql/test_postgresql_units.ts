import { EvidInventory, EvidPostgresqlAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Extracts PostgreSQL schema units with exact quoted and folded identities.
 *
 * Cross-file definitions add ownership, while composite relations retain their
 * ordered qualified endpoints.
 *
 * 1. Analyze quoted names, folded names, and schemas split across files.
 * 2. Verify units, ownership, composite relations, and target resolution.
 * 3. Require exact address behavior for quoted segments.
 */
export async function test_postgresql_units(): Promise<void> {
  const snapshot = EvidTestSourceSnapshot.combine([
    EvidTestSourceSnapshot.create(
      "schema.sql",
      dedent`
      CREATE SCHEMA app;
      CREATE TABLE app.Account (ID integer CHECK (ID > 0), region integer NOT NULL, PRIMARY KEY (ID, region), UNIQUE (ID, region));
      CREATE TABLE app."Order.Item" (
        "Item.ID" integer,
        account_id integer,
        region integer,
        single_owner integer REFERENCES app.Owner (id),
        FOREIGN KEY (account_id, region) REFERENCES app.Account (ID, region)
      );
    `,
      ["schema.sql", "alias.sql"],
    ),
    EvidTestSourceSnapshot.create(
      "extend.sql",
      dedent`
      ALTER TABLE app.Account ADD COLUMN label text;
      ALTER TABLE app.Account ADD CONSTRAINT region_fk FOREIGN KEY (ID, region) REFERENCES app.Account (ID, region);
      COMMENT ON COLUMN app.Account.label IS '@evidence spec.md#label Describes the label.';
    `,
    ),
  ]);
  const inventory = await new EvidPostgresqlAdapter().analyze(snapshot);

  TestValidator.equals(
    "complete PostgreSQL inventory",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "exact schema denominator",
    inventory.units
      .map((unit) => [String(unit.symbol), unit.identity])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en")),
    [
      ["model", ["app", "account"]],
      ["column", ["app", "account", "id"]],
      ["column", ["app", "account", "region"]],
      ["model", ["app", "Order.Item"]],
      ["column", ["app", "Order.Item", "Item.ID"]],
      ["column", ["app", "Order.Item", "account_id"]],
      ["column", ["app", "Order.Item", "region"]],
      ["column", ["app", "Order.Item", "single_owner"]],
      [
        "relation",
        [
          "app",
          "Order.Item",
          'foreign key ["single_owner"] references ["app","owner","id"]',
        ],
      ],
      [
        "relation",
        [
          "app",
          "Order.Item",
          'foreign key ["account_id","region"] references ["app","account","id","region"]',
        ],
      ],
      ["column", ["app", "account", "label"]],
      ["relation", ["app", "account", "constraint region_fk"]],
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en")),
  );
  for (const unit of inventory.units.filter((unit) => unit.symbol !== "model"))
    TestValidator.equals(
      "each member belongs to its table",
      inventory.units.find((owner) => owner.id === unit.parentId)?.identity,
      unit.identity.slice(0, 2),
    );
  const graph = new EvidInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  TestValidator.equals(
    "literal-dot file alias",
    graph.resolve(
      {
        file: "/project/alias.sql",
        segments: ["app", "Order.Item", "Item.ID"],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "quoted case is exact",
    graph.resolve(
      {
        file: "/project/alias.sql",
        segments: ["app", "order.item", "Item.ID"],
      },
      selected,
    ).status,
    "missing",
  );
  const commentHost = inventory.hosts.find(
    (host) => host.id === inventory.declarations[0]?.hostId,
  );
  if (commentHost === undefined) throw new Error("Missing COMMENT host.");
  TestValidator.equals(
    "COMMENT maps to added column",
    commentHost.unitIds.map(
      (id) => inventory.units.find((unit) => unit.id === id)?.identity,
    ),
    [["app", "account", "label"]],
  );
  const reversed = await new EvidPostgresqlAdapter().analyze({
    ...snapshot,
    files: [...snapshot.files].reverse(),
  });
  TestValidator.equals(
    "extension files may precede CREATE",
    reversed.diagnostics,
    [],
  );
  TestValidator.equals(
    "same semantic identity independent of file order",
    reversed.units
      .map((unit) => unit.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    inventory.units
      .map((unit) => unit.id)
      .sort((a, b) => a.localeCompare(b, "en")),
  );
}
