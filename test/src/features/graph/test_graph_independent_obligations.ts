import { EvidGraph } from "evid";
import type { IEvidGraphClaim } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Keeps overlapping claims and repeated references as independent coverage
 * obligations.
 *
 * The same semantic target appears in multiple graph boundaries. One accepted
 * acknowledgement must not discharge another claim's requirement or bypass a
 * stricter policy on a repeated reference. Findings must retain the boundary
 * that actually failed.
 *
 * 1. Give the first claim evidence and remove it from a copied second claim:
 *
 *    - The first obligation has no missing units; the second still misses the
 *         target.
 *    - Exactly one missing finding identifies claim 1, reference 0 using zero-based
 *         indices, and its message includes the second claim's label.
 * 2. Evaluate one exclusion against two references selecting the same target:
 *
 *    - The permissive reference is covered.
 *    - The exclusion-forbidding reference remains missing.
 *    - Exactly one forbidden-exclusion finding identifies claim 0, reference 1.
 */
export async function test_graph_independent_obligations(): Promise<void> {
  const reference = EvidTestInventory.create();
  const target = EvidTestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );

  const firstClaim = EvidTestInventory.create();
  const firstUnit = EvidTestInventory.unit(
    firstClaim,
    "first-claim",
    ["FirstClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const firstHost = EvidTestInventory.host(
    firstClaim,
    "first-host",
    firstUnit.sites[0]?.id ?? "",
    [firstUnit.id],
    "/** Shared documentation. */",
  );
  const firstEvid = EvidTestGraph.declaration(
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

  const independent = EvidGraph.evaluate({
    claims: [
      claim(firstClaim, firstUnit.id, [
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [EvidTestGraph.resolved(firstEvid, target)],
        },
      ]),
      uncoveredClaim,
    ],
  });

  TestValidator.equals(
    "first claim covered",
    EvidTestGraph.obligation(independent, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "second claim remains missing",
    EvidTestGraph.obligation(independent, 1, 0).missingUnitIds,
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
  const exclusionClaim = EvidTestInventory.create();
  const exclusionUnit = EvidTestInventory.unit(
    exclusionClaim,
    "exclusion-claim",
    ["ExclusionClaim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const exclusionHost = EvidTestInventory.host(
    exclusionClaim,
    "exclusion-host",
    exclusionUnit.sites[0]?.id ?? "",
    [exclusionUnit.id],
    "/** Shared documentation. */",
  );
  const exclusion = EvidTestGraph.declaration(
    exclusionClaim,
    "exclusion",
    exclusionHost,
    "evidenceExclude",
    "target",
  );
  const repeated = EvidGraph.evaluate({
    claims: [
      claim(exclusionClaim, exclusionUnit.id, [
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [EvidTestGraph.resolved(exclusion, target)],
        },
        {
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [EvidTestGraph.resolved(exclusion, target)],
          noEvidExclude: true,
        },
      ]),
    ],
  });

  TestValidator.equals(
    "permitted exclusion covers first reference",
    EvidTestGraph.obligation(repeated, 0, 0).coveredUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "forbidden exclusion leaves second reference missing",
    EvidTestGraph.obligation(repeated, 0, 1).missingUnitIds,
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

/**
 * Builds one active graph claim around the supplied independent references.
 *
 * The helper keeps fixture setup focused on the changed population or policy.
 * It preserves reference order because the assertions verify diagnostic
 * indices.
 */
function claim(
  inventory: IEvidGraphClaim["inventory"],
  unitId: string,
  references: IEvidGraphClaim["references"],
): IEvidGraphClaim {
  return {
    severity: "error",
    inventory,
    unitIds: [unitId],
    references,
  };
}
