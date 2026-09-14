import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** A withdrawal on any merged declaration removes that identity, descendants, and eligible hosts. */
export async function test_inventory_withdrawal(): Promise<void> {
  const first = TestInventory.create();
  TestInventory.unit(
    first,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  TestInventory.unit(
    first,
    "value",
    ["Box", "value"],
    "property",
    "value = 1",
    "box",
  );
  TestInventory.host(
    first,
    "box-doc",
    "box-site",
    ["box"],
    "/** Class documentation. */",
  );
  const second = TestInventory.create();
  const merged = TestInventory.unit(
    second,
    "box",
    ["Box"],
    "type",
    "export interface Box { extra: string; }",
  );
  for (const site of merged.sites) site.id = "box-interface-site";
  merged.withdrawals.push({
    tag: "internal",
    location: {
      file: "/project/source.ts",
      range: TestInventory.range(second, "/** Class documentation. */"),
    },
  });

  const index = new EvidenceInventory([first, second]);
  const selected = index.select(["box", "value"]);

  TestValidator.predicate(
    "withdrawal is not an analysis failure",
    selected.complete,
  );
  TestValidator.equals(
    "merged declaration locations retained",
    index
      .snapshot()
      .units.filter((unit) => unit.id === "box")
      .flatMap((unit) => unit.sites).length,
    2,
  );
  TestValidator.equals("withdrawn obligations", selected.units, []);
  TestValidator.equals("withdrawn documentation hosts", selected.hosts, []);
  const resolution = index.resolve(
    { file: "/project/source.ts", segments: ["Box", "value"] },
    ["value"],
  );
  TestValidator.equals(
    "withdrawal cause instead of missing",
    resolution.status,
    "hidden",
  );
  TestValidator.equals(
    "inherited withdrawal metadata",
    resolution.withdrawals.map((withdrawal) => withdrawal.tag),
    ["internal"],
  );
}
