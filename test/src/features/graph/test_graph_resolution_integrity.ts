import { TestValidator } from "@nestia/e2e";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/** Rejects inconsistent materialized resolution records without granting coverage. */
export async function test_graph_resolution_integrity(): Promise<void> {
  const reference = TestInventory.create();
  const target = TestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const other = TestInventory.unit(
    reference,
    "other",
    ["Other"],
    "property",
    "export const unrelated = 3;",
  );
  const claim = TestInventory.create();
  const claimUnit = TestInventory.unit(
    claim,
    "claim",
    ["Claim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const host = TestInventory.host(
    claim,
    "host",
    claimUnit.sites[0]?.id ?? "",
    [claimUnit.id],
    "/** Shared documentation. */",
  );
  const declaration = TestGraph.declaration(
    claim,
    "declaration",
    host,
    "evidence",
    "target",
  );

  // Two different answers for one declaration invalidate the materialized mapping.
  const conflicting = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [claimUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [
              TestGraph.resolved(declaration, target),
              TestGraph.resolved(declaration, other),
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "conflicting mapping finding",
    count(conflicting, "graph-conflicting-resolution"),
    1,
  );
  TestValidator.equals(
    "conflicting mapping grants no coverage",
    TestGraph.obligation(conflicting, 0, 0).missingUnitIds,
    [target.id],
  );

  // A mapping for no declaration in the claim cannot become an evidence edge.
  const orphan = TestGraph.resolved(declaration, target);
  orphan.declarationId = "orphan";
  const orphaned = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [claimUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [orphan],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "orphan mapping finding",
    count(orphaned, "graph-resolution-declaration"),
    1,
  );
  TestValidator.equals(
    "orphan mapping grants no coverage",
    TestGraph.obligation(orphaned, 0, 0).missingUnitIds,
    [target.id],
  );

  // A semantic identity outside the selected reference scopes is refused even when resolved.
  const outside = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [claimUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [TestGraph.resolved(declaration, other)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "out-of-scope mapping finding",
    count(outside, "graph-resolution-scope"),
    1,
  );
  TestValidator.equals(
    "out-of-scope mapping grants no coverage",
    TestGraph.obligation(outside, 0, 0).missingUnitIds,
    [target.id],
  );
}

function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
