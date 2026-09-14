import { EvidenceGraph } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/**
 * Refuses prepared resolution records that violate declaration or population identity.
 *
 * The graph accepts materialized resolutions from callers, so resolved status
 * alone cannot establish a valid evidence edge. Each record must identify one
 * actual claim statement and a target inside the selected reference's scope closure.
 *
 * 1. Supply two different target answers for one acknowledgement; require one
 *    graph-conflicting-resolution finding and leave the required target missing.
 * 2. Supply a resolution naming no claim declaration; require one
 *    graph-resolution-declaration finding and no coverage.
 * 3. Resolve the acknowledgement to an unrelated unselected reference identity;
 *    require one graph-resolution-scope finding and keep the selected target missing.
 */
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

/**
 * Counts a specific integrity diagnostic in the full graph result.
 *
 * The scenario checks one direct finding per invalid mapping while separately
 * asserting that the mapping did not contribute coverage.
 */
function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
