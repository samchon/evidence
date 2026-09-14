import { TestValidator } from "@nestia/e2e";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/** Cascades real structural scopes and reports each later acknowledgement conflict once. */
export async function test_graph_hierarchy_conflicts(): Promise<void> {
  const reference = TestInventory.create();
  const parent = TestInventory.unit(
    reference,
    "parent",
    ["Parent"],
    "type",
    "export class Box { value = 1; }",
  );
  const child = TestInventory.unit(
    reference,
    "child",
    ["Parent", "child"],
    "property",
    "value = 1",
    parent.id,
  );
  const sibling = TestInventory.unit(
    reference,
    "sibling",
    ["Parent", "sibling"],
    "property",
    "extra: string",
    parent.id,
  );
  const unrelated = TestInventory.unit(
    reference,
    "unrelated",
    ["Unrelated"],
    "property",
    "export const unrelated = 3;",
  );

  const aggregateClaim = TestInventory.create();
  const aggregateUnit = TestInventory.unit(
    aggregateClaim,
    "aggregate-claim",
    ["AggregateClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const aggregateHost = TestInventory.host(
    aggregateClaim,
    "aggregate-host",
    aggregateUnit.sites[0]?.id ?? "",
    [aggregateUnit.id],
    "/** Shared documentation. */",
  );
  const aggregate = TestGraph.declaration(
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
            resolutions: [TestGraph.resolved(aggregate, parent)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "aggregate covers selected descendants",
    TestGraph.obligation(cascade, 0, 0).coveredUnitIds,
    [child.id, sibling.id],
  );
  TestValidator.equals(
    "unrelated unit remains missing",
    TestGraph.obligation(cascade, 0, 0).missingUnitIds,
    [unrelated.id],
  );

  // Repeating one positive scope differs from overlapping exclusions and opposite intent.
  const conflictClaim = TestInventory.create();
  const conflictUnit = TestInventory.unit(
    conflictClaim,
    "conflict-claim",
    ["ConflictClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const otherClaimUnit = TestInventory.unit(
    conflictClaim,
    "other-claim",
    ["OtherClaim"],
    "property",
    "export const unrelated = 3;",
  );
  const conflictHost = TestInventory.host(
    conflictClaim,
    "conflict-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Shared documentation. */",
  );
  const mergedHost = TestInventory.host(
    conflictClaim,
    "merged-host",
    conflictUnit.sites[0]?.id ?? "",
    [conflictUnit.id],
    "/** Class documentation. */",
  );
  const otherHost = TestInventory.host(
    conflictClaim,
    "other-host",
    otherClaimUnit.sites[0]?.id ?? "",
    [otherClaimUnit.id],
    "/** Class documentation. */",
  );
  const first = TestGraph.declaration(
    conflictClaim,
    "first",
    conflictHost,
    "evidence",
    "child",
  );
  const repeated = TestGraph.declaration(
    conflictClaim,
    "repeated",
    mergedHost,
    "evidence",
    "child",
  );
  const otherEvidence = TestGraph.declaration(
    conflictClaim,
    "other-evidence",
    otherHost,
    "evidence",
    "child",
  );
  const excluded = TestGraph.declaration(
    conflictClaim,
    "excluded",
    conflictHost,
    "evidenceExclude",
    "child",
  );
  const overlapping = TestGraph.declaration(
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
              TestGraph.resolved(first, child),
              TestGraph.resolved(repeated, child),
              TestGraph.resolved(otherEvidence, child),
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
              TestGraph.resolved(first, child),
              TestGraph.resolved(excluded, child),
              TestGraph.resolved(overlapping, parent),
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
    TestGraph.obligation(conflicts, 0, 0).missingUnitIds,
    [],
  );
}

function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
