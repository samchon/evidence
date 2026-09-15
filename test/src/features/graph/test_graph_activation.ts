import { EvidGraph } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Distinguishes inactive claims from claims whose discovery could not complete.
 *
 * A complete empty claim owes no reference work, but failed discovery cannot prove
 * emptiness. Activation must preserve that distinction before reference failures
 * or derived missing-evidence findings are considered.
 *
 * 1. Give an off claim a failed reference and require an inactive claim and
 *    obligation, no diagnostics, and successful graph evaluation.
 * 2. Select no units from a complete claim and require the same inactive boundary
 *    without exposing the failed reference's diagnostics.
 * 3. Mark claim discovery incomplete with an empty selection and require it to
 *    remain active, with incomplete claim and obligation state and overall failure.
 *    Do not emit derived missing-acknowledgement findings from that partial input.
 * 4. Remove all references from the incomplete claim and require failure anyway,
 *    proving claim completeness does not depend on an obligation carrying the error.
 */
export async function test_graph_activation(): Promise<void> {
  const claim = EvidTestInventory.create();
  const claimUnit = EvidTestInventory.unit(
    claim,
    "claim",
    ["Claim"],
    "type",
    "export class Box { value = 1; }",
  );
  const reference = EvidTestInventory.create();
  const referenceUnit = EvidTestInventory.unit(
    reference,
    "reference",
    ["Reference"],
    "property",
    "export const unrelated = 3;",
  );

  // A disabled claim never exposes failures from a reference it does not need.
  const failedReference = structuredClone(reference);
  failedReference.complete = false;
  failedReference.diagnostics.push({
    code: "source-unreadable",
    severity: "error",
    message: "The reference file could not be read.",
    repair: "Restore access to the reference file.",
  });
  const disabled = EvidGraph.evaluate({
    claims: [
      {
        severity: "off",
        inventory: claim,
        unitIds: [claimUnit.id],
        references: [
          {
            severity: "error",
            inventory: failedReference,
            unitIds: [referenceUnit.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals("disabled claim", disabled.claims[0]?.active, false);
  TestValidator.equals(
    "disabled obligation",
    EvidTestGraph.obligation(disabled, 0, 0).active,
    false,
  );
  TestValidator.equals("disabled diagnostics", disabled.diagnostics, []);
  TestValidator.equals("disabled success", disabled.success, true);

  // A healthy claim with no selected units is inactive for the same reason.
  const empty = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [],
        references: [
          {
            severity: "error",
            inventory: failedReference,
            unitIds: [referenceUnit.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals("empty claim", empty.claims[0]?.active, false);
  TestValidator.equals(
    "empty obligation",
    EvidTestGraph.obligation(empty, 0, 0).active,
    false,
  );
  TestValidator.equals("empty diagnostics", empty.diagnostics, []);

  // Failed claim discovery cannot prove an empty population and keeps every enabled obligation incomplete.
  const failedClaim = structuredClone(claim);
  failedClaim.complete = false;
  failedClaim.diagnostics.push({
    code: "source-unreadable",
    severity: "error",
    message: "The claim file could not be read.",
    repair: "Restore access to the claim file.",
  });
  const incomplete = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: failedClaim,
        unitIds: [],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [referenceUnit.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "failed claim stays active",
    incomplete.claims[0]?.active,
    true,
  );
  TestValidator.equals(
    "failed claim leaves obligation incomplete",
    EvidTestGraph.obligation(incomplete, 0, 0).complete,
    false,
  );
  TestValidator.equals(
    "failed claim result incomplete",
    incomplete.claims[0]?.complete,
    false,
  );
  TestValidator.equals(
    "failed claim has no derived coverage finding",
    incomplete.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-missing-acknowledgement",
    ),
    [],
  );
  TestValidator.equals(
    "failed claim is unsuccessful",
    incomplete.success,
    false,
  );

  // Claim completeness still gates success when there is no reference obligation to carry it.
  const incompleteWithoutReferences = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: failedClaim,
        unitIds: [],
        references: [],
      },
    ],
  });

  TestValidator.equals(
    "incomplete claim without references is unsuccessful",
    incompleteWithoutReferences.success,
    false,
  );
}
