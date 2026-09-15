import { EvidGraph } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

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
  const reference = EvidTestInventory.create();
  const target = EvidTestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const other = EvidTestInventory.unit(
    reference,
    "other",
    ["Other"],
    "property",
    "export const unrelated = 3;",
  );
  const claim = EvidTestInventory.create();
  const claimUnit = EvidTestInventory.unit(
    claim,
    "claim",
    ["Claim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const host = EvidTestInventory.host(
    claim,
    "host",
    claimUnit.sites[0]?.id ?? "",
    [claimUnit.id],
    "/** Shared documentation. */",
  );
  const declaration = EvidTestGraph.declaration(
    claim,
    "declaration",
    host,
    "evidence",
    "target",
  );

  // Two different answers for one declaration invalidate the materialized mapping.
  const conflicting = EvidGraph.evaluate({
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
              EvidTestGraph.resolved(declaration, target),
              EvidTestGraph.resolved(declaration, other),
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
    EvidTestGraph.obligation(conflicting, 0, 0).missingUnitIds,
    [target.id],
  );

  // A mapping for no declaration in the claim cannot become an evidence edge.
  const orphan = EvidTestGraph.resolved(declaration, target);
  orphan.declarationId = "orphan";
  const orphaned = EvidGraph.evaluate({
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
    EvidTestGraph.obligation(orphaned, 0, 0).missingUnitIds,
    [target.id],
  );

  // A semantic identity outside the selected reference scopes is refused even when resolved.
  const outside = EvidGraph.evaluate({
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
            resolutions: [EvidTestGraph.resolved(declaration, other)],
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
    EvidTestGraph.obligation(outside, 0, 0).missingUnitIds,
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
  result: ReturnType<typeof EvidGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
