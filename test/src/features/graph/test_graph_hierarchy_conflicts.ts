import { EvidGraph } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Expands explicit target hierarchy and attributes acknowledgement conflicts
 * once per scope.
 *
 * Aggregate citations cover selected descendants without covering unrelated
 * units. Conflict detection must distinguish repeated positive evidence on one
 * semantic host, evidence from another host, overlapping exclusions, and
 * opposite intent without multiplying findings for every descendant in an
 * aggregate scope.
 *
 * 1. Cite an unselected parent and require its two selected children to be covered
 *    while an unrelated selected declaration remains missing.
 * 2. Repeat one child citation across two physical fragments of the same semantic
 *    host and also cite it from another host; require one duplicate-evidence
 *    finding.
 * 3. Follow positive child evidence with child and parent exclusions:
 *
 *    - Require one opposite-intent finding for each later exclusion scope.
 *    - Require one duplicate-exclusion finding for the overlap.
 *    - Retain coverage of both selected children despite the conflict diagnostics.
 */
export async function test_graph_hierarchy_conflicts(): Promise<void> {
  const reference = EvidTestInventory.create();
  const parent = EvidTestInventory.unit(
    reference,
    "parent",
    ["Parent"],
    "type",
    "export class Box { value = 1; }",
  );
  const child = EvidTestInventory.unit(
    reference,
    "child",
    ["Parent", "child"],
    "property",
    "value = 1",
    parent.id,
  );
  const sibling = EvidTestInventory.unit(
    reference,
    "sibling",
    ["Parent", "sibling"],
    "property",
    "extra: string",
    parent.id,
  );
  const unrelated = EvidTestInventory.unit(
    reference,
    "unrelated",
    ["Unrelated"],
    "property",
    "export const unrelated = 3;",
  );

  const aggregateClaim = EvidTestInventory.create();
  const aggregateUnit = EvidTestInventory.unit(
    aggregateClaim,
    "aggregate-claim",
    ["AggregateClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const aggregateHost = EvidTestInventory.host(
    aggregateClaim,
    "aggregate-host",
    aggregateUnit.sites[0]?.id ?? "",
    [aggregateUnit.id],
    "/** Shared documentation. */",
  );
  const aggregate = EvidTestGraph.declaration(
    aggregateClaim,
    "aggregate",
    aggregateHost,
    "evidence",
    "parent",
  );
  const cascade = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: aggregateClaim,
        unitIds: [aggregateUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [child.id, sibling.id, unrelated.id],
            resolutions: [EvidTestGraph.resolved(aggregate, parent)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "aggregate covers selected descendants",
    EvidTestGraph.obligation(cascade, 0, 0).coveredUnitIds,
    [child.id, sibling.id],
  );
  TestValidator.equals(
    "unrelated unit remains missing",
    EvidTestGraph.obligation(cascade, 0, 0).missingUnitIds,
    [unrelated.id],
  );

  // Repeating one positive scope differs from overlapping exclusions and opposite intent.
  const conflictClaim = EvidTestInventory.create();
  const conflictUnit = EvidTestInventory.unit(
    conflictClaim,
    "conflict-claim",
    ["ConflictClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const otherClaimUnit = EvidTestInventory.unit(
    conflictClaim,
    "other-claim",
    ["OtherClaim"],
    "property",
    "export const unrelated = 3;",
  );
  const conflictHost = EvidTestInventory.host(
    conflictClaim,
    "conflict-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Shared documentation. */",
  );
  const mergedHost = EvidTestInventory.host(
    conflictClaim,
    "merged-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Class documentation. */",
  );
  const otherHost = EvidTestInventory.host(
    conflictClaim,
    "other-host",
    otherClaimUnit.sites[0]?.id ?? "",
    [otherClaimUnit.id],
    "/** Class documentation. */",
  );
  const first = EvidTestGraph.declaration(
    conflictClaim,
    "first",
    conflictHost,
    "evidence",
    "child",
  );
  const repeated = EvidTestGraph.declaration(
    conflictClaim,
    "repeated",
    mergedHost,
    "evidence",
    "child",
  );
  const otherEvid = EvidTestGraph.declaration(
    conflictClaim,
    "other-evidence",
    otherHost,
    "evidence",
    "child",
  );
  const excluded = EvidTestGraph.declaration(
    conflictClaim,
    "excluded",
    conflictHost,
    "evidenceExclude",
    "child",
  );
  const overlapping = EvidTestGraph.declaration(
    conflictClaim,
    "overlapping",
    conflictHost,
    "evidenceExclude",
    "parent",
  );
  const repeatedEvid = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: conflictClaim,
        unitIds: [conflictUnit.id, otherClaimUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [child.id, sibling.id],
            resolutions: [
              EvidTestGraph.resolved(first, child),
              EvidTestGraph.resolved(repeated, child),
              EvidTestGraph.resolved(otherEvid, child),
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "duplicate positive scope",
    count(repeatedEvid, "graph-duplicate-evidence"),
    1,
  );

  // Each later exclusion reports one finding even when its scope covers several descendants.
  const conflicts = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: conflictClaim,
        unitIds: [conflictUnit.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [child.id, sibling.id],
            resolutions: [
              EvidTestGraph.resolved(first, child),
              EvidTestGraph.resolved(excluded, child),
              EvidTestGraph.resolved(overlapping, parent),
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "one opposite-intent finding per later scope",
    count(conflicts, "graph-conflicting-acknowledgements"),
    2,
  );
  TestValidator.equals(
    "overlapping exclusions",
    count(conflicts, "graph-duplicate-exclusion"),
    1,
  );
  TestValidator.equals(
    "conflicting scopes still cover",
    EvidTestGraph.obligation(conflicts, 0, 0).missingUnitIds,
    [],
  );
}

/**
 * Counts one graph finding category across the complete evaluation result.
 *
 * Scope-conflict assertions use this to detect duplicate diagnostics caused by
 * expanding a single authored acknowledgement over multiple descendants.
 */
function count(
  result: ReturnType<typeof EvidGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
