import { EvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestInventory } from "../../internal/EvidenceTestInventory";

/**
 * Propagates withdrawal from a merged declaration to its descendants and hosts.
 *
 * A class and interface can contribute sites to one semantic identity.
 * Visibility must consider every merged site; otherwise a public fragment could
 * bypass an internal annotation on another fragment and leave its child API
 * selected.
 *
 * 1. Create a class identity with a property and documentation host, then add an
 *    interface site carrying an internal withdrawal on the same identity.
 * 2. Merge the inventories and select the parent and child:
 *
 *    - Analysis remains complete and both declaration sites remain retained.
 *    - Neither withdrawn unit nor its documentation host remains eligible.
 * 3. Resolve the child's public address and require hidden status with the
 *    inherited internal directive, preserving the cause instead of reporting
 *    missing.
 */
export async function test_inventory_withdrawal(): Promise<void> {
  const first = EvidenceTestInventory.create();
  EvidenceTestInventory.unit(
    first,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  EvidenceTestInventory.unit(
    first,
    "value",
    ["Box", "value"],
    "property",
    "value = 1",
    "box",
  );
  EvidenceTestInventory.host(
    first,
    "box-doc",
    "box-site",
    ["box"],
    "/** Class documentation. */",
  );
  const second = EvidenceTestInventory.create();
  const merged = EvidenceTestInventory.unit(
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
      range: EvidenceTestInventory.range(second, "/** Class documentation. */"),
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
