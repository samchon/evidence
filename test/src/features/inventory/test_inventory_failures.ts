import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** Partial sources, conflicting identities, missing parents, and cycles never yield a healthy empty inventory. */
export async function test_inventory_failures(): Promise<void> {
  const empty = TestInventory.create();
  TestValidator.predicate(
    "healthy empty population",
    new EvidenceInventory([empty]).select([]).complete,
  );
  empty.complete = false;
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

  const input = TestInventory.create();
  const box = TestInventory.unit(
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
