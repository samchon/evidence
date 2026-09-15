import { EvidenceGraph } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestInventory } from "../../internal/EvidenceTestInventory";

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
  const reference = EvidenceTestInventory.create();
  const parent = EvidenceTestInventory.unit(
    reference,
    "parent",
    ["Parent"],
    "type",
    "export class Box { value = 1; }",
  );
  const child = EvidenceTestInventory.unit(
    reference,
    "child",
    ["Parent", "child"],
    "property",
    "value = 1",
    parent.id,
  );
  const sibling = EvidenceTestInventory.unit(
    reference,
    "sibling",
    ["Parent", "sibling"],
    "property",
    "extra: string",
    parent.id,
  );
  const unrelated = EvidenceTestInventory.unit(
    reference,
    "unrelated",
    ["Unrelated"],
    "property",
    "export const unrelated = 3;",
  );

  const aggregateClaim = EvidenceTestInventory.create();
  const aggregateUnit = EvidenceTestInventory.unit(
    aggregateClaim,
    "aggregate-claim",
    ["AggregateClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const aggregateHost = EvidenceTestInventory.host(
    aggregateClaim,
    "aggregate-host",
    aggregateUnit.sites[0]?.id ?? "",
    [aggregateUnit.id],
    "/** Shared documentation. */",
  );
  const aggregate = EvidenceTestGraph.declaration(
    aggregateClaim,
    "aggregate",
    aggregateHost,
    "evidence",
    "parent",
  );
  const cascade = EvidenceGraph.evaluate({
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
            resolutions: [EvidenceTestGraph.resolved(aggregate, parent)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "aggregate covers selected descendants",
    EvidenceTestGraph.obligation(cascade, 0, 0).coveredUnitIds,
    [child.id, sibling.id],
  );
  TestValidator.equals(
    "unrelated unit remains missing",
    EvidenceTestGraph.obligation(cascade, 0, 0).missingUnitIds,
    [unrelated.id],
  );

  // Repeating one positive scope differs from overlapping exclusions and opposite intent.
  const conflictClaim = EvidenceTestInventory.create();
  const conflictUnit = EvidenceTestInventory.unit(
    conflictClaim,
    "conflict-claim",
    ["ConflictClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const otherClaimUnit = EvidenceTestInventory.unit(
    conflictClaim,
    "other-claim",
    ["OtherClaim"],
    "property",
    "export const unrelated = 3;",
  );
  const conflictHost = EvidenceTestInventory.host(
    conflictClaim,
    "conflict-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Shared documentation. */",
  );
  const mergedHost = EvidenceTestInventory.host(
    conflictClaim,
    "merged-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Class documentation. */",
  );
  const otherHost = EvidenceTestInventory.host(
    conflictClaim,
    "other-host",
    otherClaimUnit.sites[0]?.id ?? "",
    [otherClaimUnit.id],
    "/** Class documentation. */",
  );
  const first = EvidenceTestGraph.declaration(
    conflictClaim,
    "first",
    conflictHost,
    "evidence",
    "child",
  );
  const repeated = EvidenceTestGraph.declaration(
    conflictClaim,
    "repeated",
    mergedHost,
    "evidence",
    "child",
  );
  const otherEvidence = EvidenceTestGraph.declaration(
    conflictClaim,
    "other-evidence",
    otherHost,
    "evidence",
    "child",
  );
  const excluded = EvidenceTestGraph.declaration(
    conflictClaim,
    "excluded",
    conflictHost,
    "evidenceExclude",
    "child",
  );
  const overlapping = EvidenceTestGraph.declaration(
    conflictClaim,
    "overlapping",
    conflictHost,
    "evidenceExclude",
    "parent",
  );
  const repeatedEvidence = EvidenceGraph.evaluate({
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
              EvidenceTestGraph.resolved(first, child),
              EvidenceTestGraph.resolved(repeated, child),
              EvidenceTestGraph.resolved(otherEvidence, child),
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "duplicate positive scope",
    count(repeatedEvidence, "graph-duplicate-evidence"),
    1,
  );

  // Each later exclusion reports one finding even when its scope covers several descendants.
  const conflicts = EvidenceGraph.evaluate({
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
              EvidenceTestGraph.resolved(first, child),
              EvidenceTestGraph.resolved(excluded, child),
              EvidenceTestGraph.resolved(overlapping, parent),
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
    EvidenceTestGraph.obligation(conflicts, 0, 0).missingUnitIds,
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
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
