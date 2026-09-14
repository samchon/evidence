import { TestValidator } from "@nestia/e2e";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import type { IEvidenceGraphClaim } from "../../../../packages/evidence/src/structures/IEvidenceGraphClaim";
import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/** Keeps overlapping claims and repeated reference entries as separate obligations. */
export async function test_graph_independent_obligations(): Promise<void> {
  const reference = TestInventory.create();
  const target = TestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );

  const firstClaim = TestInventory.create();
  const firstUnit = TestInventory.unit(
    firstClaim,
    "first-claim",
    ["FirstClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const firstHost = TestInventory.host(
    firstClaim,
    "first-host",
    firstUnit.sites[0]?.id ?? "",
    [firstUnit.id],
    "/** Shared documentation. */",
  );
  const firstEvidence = TestGraph.declaration(
    firstClaim,
    "first-evidence",
    firstHost,
    "evidence",
    "target",
  );

  const secondClaim = structuredClone(firstClaim);
  secondClaim.declarations = [];
  const uncoveredClaim = claim(secondClaim, firstUnit.id, [
    {
      severity: "error",
      inventory: reference,
      unitIds: [target.id],
      resolutions: [],
    },
  ]);
  uncoveredClaim.name = "secondary";

  const independent = EvidenceGraph.evaluate({
    claims: [
      claim(firstClaim, firstUnit.id, [
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [TestGraph.resolved(firstEvidence, target)],
        },
      ]),
      uncoveredClaim,
    ],
  });

  TestValidator.equals(
    "first claim covered",
    TestGraph.obligation(independent, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "second claim remains missing",
    TestGraph.obligation(independent, 1, 0).missingUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "one independent missing finding",
    independent.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-missing-acknowledgement",
    ).length,
    1,
  );
  const independentMissing = independent.diagnostics.find(
    (diagnostic) => diagnostic.code === "graph-missing-acknowledgement",
  );
  if (independentMissing === undefined)
    throw new Error("Missing independent obligation finding.");
  TestValidator.equals(
    "missing finding retains claim identity",
    [independentMissing.claim, independentMissing.reference],
    [1, 0],
  );
  TestValidator.predicate(
    "claim name labels the finding",
    independentMissing.message.startsWith("Claim 2 ('secondary') reference 1:"),
  );

  // Identical reference populations retain their own exclusion policies.
  const exclusionClaim = TestInventory.create();
  const exclusionUnit = TestInventory.unit(
    exclusionClaim,
    "exclusion-claim",
    ["ExclusionClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const exclusionHost = TestInventory.host(
    exclusionClaim,
    "exclusion-host",
    exclusionUnit.sites[0]?.id ?? "",
    [exclusionUnit.id],
    "/** Shared documentation. */",
  );
  const exclusion = TestGraph.declaration(
    exclusionClaim,
    "exclusion",
    exclusionHost,
    "evidenceExclude",
    "target",
  );
  const repeated = EvidenceGraph.evaluate({
    claims: [
      claim(exclusionClaim, exclusionUnit.id, [
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [TestGraph.resolved(exclusion, target)],
        },
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [TestGraph.resolved(exclusion, target)],
          noEvidenceExclude: true,
        },
      ]),
    ],
  });

  TestValidator.equals(
    "permitted exclusion covers first reference",
    TestGraph.obligation(repeated, 0, 0).coveredUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "forbidden exclusion leaves second reference missing",
    TestGraph.obligation(repeated, 0, 1).missingUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "reference policy diagnostic",
    repeated.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-forbidden-exclusion",
    ).length,
    1,
  );
  const forbidden = repeated.diagnostics.find(
    (diagnostic) => diagnostic.code === "graph-forbidden-exclusion",
  );
  TestValidator.equals(
    "reference policy retains entry identity",
    [forbidden?.claim, forbidden?.reference],
    [0, 1],
  );
}

function claim(
  inventory: IEvidenceGraphClaim["inventory"],
  unitId: string,
  references: IEvidenceGraphClaim["references"],
): IEvidenceGraphClaim {
  return {
    severity: "error",
    inventory,
    unitIds: [unitId],
    references,
  };
}
