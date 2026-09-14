import {
  EvidenceInventory,
  EvidencePostgresqlAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves quoted segments, folded names, composite relations, and cross-file additive ownership. */
export async function test_postgresql_units(): Promise<void> {
  const inventory = await new EvidencePostgresqlAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "schema.sql",
        dedent`
      CREATE SCHEMA app;
      CREATE TABLE app.Account (ID integer PRIMARY KEY, region integer NOT NULL);
      CREATE TABLE app."Order.Item" (
        "Item.ID" integer,
        account_id integer,
        region integer,
        FOREIGN KEY (account_id, region) REFERENCES app.Account (ID, region)
      );
    `,
        ["schema.sql", "alias.sql"],
      ),
      TestSourceSnapshot.create(
        "extend.sql",
        dedent`
      ALTER TABLE app.Account ADD COLUMN label text;
      COMMENT ON COLUMN app.Account.label IS '@evidence spec.md#label Describes the label.';
    `,
      ),
    ]),
  );

  TestValidator.equals(
    "complete PostgreSQL inventory",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "exact schema denominator",
    inventory.units.map((unit) => [unit.symbol, unit.identity]),
    [
      ["model", ["app", "account"]],
      ["column", ["app", "account", "id"]],
      ["column", ["app", "account", "region"]],
      ["model", ["app", "Order.Item"]],
      ["column", ["app", "Order.Item", "Item.ID"]],
      ["column", ["app", "Order.Item", "account_id"]],
      ["column", ["app", "Order.Item", "region"]],
      [
        "relation",
        [
          "app",
          "Order.Item",
          'foreign key ["account_id","region"] references ["app","account","id","region"]',
        ],
      ],
      ["column", ["app", "account", "label"]],
    ],
  );
  for (const unit of inventory.units.filter((unit) => unit.symbol !== "model"))
    TestValidator.equals(
      "each member belongs to its table",
      inventory.units.find((owner) => owner.id === unit.parentId)?.identity,
      unit.identity.slice(0, 2),
    );
  const graph = new EvidenceInventory([inventory]);
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
  TestValidator.equals(
    "COMMENT maps to added column",
    inventory.hosts
      .find((host) => host.id === inventory.declarations[0]?.hostId)
      ?.unitIds.map(
        (id) => inventory.units.find((unit) => unit.id === id)?.identity,
      ),
    [["app", "account", "label"]],
  );
}
