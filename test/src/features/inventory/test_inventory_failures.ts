import { EvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestInventory } from "../../internal/EvidenceTestInventory";

/**
 * Preserves incomplete analysis when inventory ownership or identity is
 * inconsistent.
 *
 * An empty or partially usable unit list cannot prove successful extraction.
 * These cases exercise the inventory boundary directly so downstream coverage
 * cannot conceal failures by selecting fewer declarations.
 *
 * 1. Compare a healthy empty inventory with the same input marked incomplete:
 *
 *    - Empty selection is complete only for the healthy input.
 *    - Lookup on failed input reports incomplete rather than merely missing.
 * 2. Give a class an absent parent and require incomplete reconciliation.
 * 3. Make that class its own parent and require terminating selection with an
 *    inventory-cycle diagnostic, rather than unbounded ancestor traversal.
 * 4. Remove the parent and merge copies assigning different symbol categories to
 *    the same ID; the contradictory identity must remain incomplete.
 */
export async function test_inventory_failures(): Promise<void> {
  const empty = EvidenceTestInventory.create();
  TestValidator.predicate(
    "healthy empty population",
    new EvidenceInventory([empty]).select([]).complete,
  );
  empty.complete = false;
  // The negative counterpart has the same empty denominator. Only its recorded
  // extraction state distinguishes failure from a valid empty population.
  const failed = new EvidenceInventory([empty]);
  TestValidator.predicate(
    "empty failure retained",
    !failed.select([]).complete,
  );
  TestValidator.equals(
    "lookup cannot conceal failure",
    failed.resolve({ file: "/project/source.ts", segments: ["Absent"] }, [])
      .status,
    "incomplete",
  );

  const input = EvidenceTestInventory.create();
  const box = EvidenceTestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
    "missing",
  );
  TestValidator.predicate(
    "missing parent fails",
    !new EvidenceInventory([input]).snapshot().complete,
  );

  box.parentId = "box";
  // The traversal must terminate even though ownership cannot be normalized.
  const cyclic = new EvidenceInventory([input]);
  TestValidator.predicate(
    "cycle terminates with a failure",
    !cyclic.select(["box"]).complete,
  );
  TestValidator.predicate(
    "cycle diagnostic",
    cyclic
      .snapshot()
      .diagnostics.some((diagnostic) => diagnostic.code === "inventory-cycle"),
  );

  delete box.parentId;
  const conflict = structuredClone(input);
  for (const unit of conflict.units) unit.symbol = "property";
  TestValidator.predicate(
    "contradictory identity cannot merge",
    !new EvidenceInventory([input, conflict]).snapshot().complete,
  );
}
