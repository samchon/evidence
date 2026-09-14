import {
  EvidenceBigQueryAdapter,
  EvidenceFingerprint,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Certifies explicit project paths, nested/repeated field ownership, and declared key units. */
export async function test_bigquery_units(): Promise<void> {
  const content = dedent`
    CREATE TABLE \`acme-prod.sales.orders\` (
      id INT64,
      customer_id INT64,
      details STRUCT<label STRING, items ARRAY<STRUCT<sku STRING, quantity INT64>>>,
      tags ARRAY<STRING>,
      PRIMARY KEY (id) NOT ENFORCED,
      CONSTRAINT customer_key FOREIGN KEY (customer_id) REFERENCES \`acme-prod.sales.customers\` (id) NOT ENFORCED
    ) OPTIONS(description="Orders schema");
  `;
  const adapter = new EvidenceBigQueryAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("schema.sql", content, [
      "schema.sql",
      "alias.sql",
    ]),
  );

  TestValidator.equals(
    "complete GoogleSQL inventory",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals("complete source", inventory.complete, true);
  TestValidator.equals(
    "exact declarations",
    inventory.units.map((unit) => [unit.symbol, unit.identity]).sort(),
    [
      ["model", ["acme-prod", "sales", "orders"]],
      ...[
        "id",
        "customer_id",
        "details",
        "details.label",
        "details.items",
        "details.items.sku",
        "details.items.quantity",
        "tags",
      ].map((name) => [
        "column",
        ["acme-prod", "sales", "orders", ...name.split(".")],
      ]),
      ["relation", ["acme-prod", "sales", "orders", "customer_key"]],
    ].sort(),
  );
  const model = inventory.units.find((unit) => unit.symbol === "model");
  if (model === undefined) throw new Error("Missing orders model.");
  TestValidator.equals(
    "every field and relation has one owning table",
    inventory.units
      .filter((unit) => unit.symbol !== "model")
      .every((unit) => unit.parentId === model.id),
    true,
  );
  TestValidator.equals(
    "file aliases retain every declaration",
    inventory.addresses.length,
    inventory.units.length * 2,
  );
  TestValidator.equals(
    "all undocumented units remain hosts",
    new Set(inventory.hosts.flatMap((host) => host.unitIds)).size,
    inventory.units.length,
  );

  const moved = await adapter.analyze(
    TestSourceSnapshot.create("moved.sql", content),
  );
  TestValidator.equals(
    "schema identity independent of file",
    moved.units.map((unit) => unit.id),
    inventory.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "file move preserves review",
    EvidenceFingerprint.inspect(moved, model.id).fingerprint,
    EvidenceFingerprint.inspect(inventory, model.id).fingerprint,
  );
  const changed = await adapter.analyze(
    TestSourceSnapshot.create(
      "schema.sql",
      content.replace("quantity INT64", "quantity NUMERIC"),
    ),
  );
  TestValidator.notEquals(
    "nested semantic edit invalidates table review",
    EvidenceFingerprint.inspect(changed, model.id).fingerprint,
    EvidenceFingerprint.inspect(inventory, model.id).fingerprint,
  );
}
