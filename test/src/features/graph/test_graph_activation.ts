import { EvidenceGraph } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/** Preserves claim activation before loading or evaluating its references. */
export async function test_graph_activation(): Promise<void> {
  const claim = TestInventory.create();
  const claimUnit = TestInventory.unit(
    claim,
    "claim",
    ["Claim"],
    "type",
    "export class Box { value = 1; }",
  );
  const reference = TestInventory.create();
  const referenceUnit = TestInventory.unit(
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
  const disabled = EvidenceGraph.evaluate({
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
    TestGraph.obligation(disabled, 0, 0).active,
    false,
  );
  TestValidator.equals("disabled diagnostics", disabled.diagnostics, []);
  TestValidator.equals("disabled success", disabled.success, true);

  // A healthy claim with no selected units is inactive for the same reason.
  const empty = EvidenceGraph.evaluate({
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
    TestGraph.obligation(empty, 0, 0).active,
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
  const incomplete = EvidenceGraph.evaluate({
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
    TestGraph.obligation(incomplete, 0, 0).complete,
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
  const incompleteWithoutReferences = EvidenceGraph.evaluate({
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
