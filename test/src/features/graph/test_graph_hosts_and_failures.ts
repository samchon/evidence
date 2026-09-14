import { TestValidator } from "@nestia/e2e";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/** Enforces host eligibility while suppressing coverage derived from failed or empty populations. */
export async function test_graph_hosts_and_failures(): Promise<void> {
  const reference = TestInventory.create();
  const target = TestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const claim = TestInventory.create();
  const selected = TestInventory.unit(
    claim,
    "selected",
    ["Selected"],
    "type",
    "export const first = 1, second = 2;",
  );
  const carrier = TestInventory.unit(
    claim,
    "carrier",
    ["Carrier"],
    "property",
    "export const unrelated = 3;",
  );
  const carrierHost = TestInventory.host(
    claim,
    "carrier-host",
    carrier.sites[0]?.id ?? "",
    [carrier.id],
    "/** Class documentation. */",
  );
  const misplacedEvidence = TestGraph.declaration(
    claim,
    "misplaced-evidence",
    carrierHost,
    "evidence",
    "target",
  );
  const acceptedExclusion = TestGraph.declaration(
    claim,
    "accepted-exclusion",
    carrierHost,
    "evidenceExclude",
    "target",
  );

  const carrierResult = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [
              TestGraph.resolved(misplacedEvidence, target),
              TestGraph.resolved(acceptedExclusion, target),
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "positive evidence stays on selected hosts",
    carrierResult.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-out-of-scope-host",
    ).length,
    1,
  );
  TestValidator.equals(
    "public exclusion carrier covers",
    TestGraph.obligation(carrierResult, 0, 0).missingUnitIds,
    [],
  );

  // An explicit empty carrier selection refuses the same exclusion and leaves coverage missing.
  const restricted = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        exclusionHostIds: [],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [TestGraph.resolved(acceptedExclusion, target)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "restricted carrier",
    TestGraph.obligation(restricted, 0, 0).missingUnitIds,
    [target.id],
  );

  // Reviews never enter the acknowledgement ledger.
  claim.reviews.push({
    id: "review",
    hostId: carrierHost.id,
    reviews: "evidence",
    target: "target",
    description: "The target was reviewed.",
    location: { file: carrierHost.file, range: carrierHost.range },
  });
  const reviewOnly = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "review supplies no coverage",
    TestGraph.obligation(reviewOnly, 0, 0).missingUnitIds,
    [target.id],
  );

  // A failed reference retains its cause and suppresses empty and missing derivatives.
  const failedReference = structuredClone(reference);
  failedReference.complete = false;
  failedReference.diagnostics.push({
    code: "source-unreadable",
    severity: "error",
    message: "The reference file could not be read.",
    repair: "Restore access to the reference file.",
  });
  const failed = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: failedReference,
            unitIds: [target.id],
            resolutions: [],
            uniqueEvidence: true,
            singleEvidencePerSymbol: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "failed obligation incomplete",
    TestGraph.obligation(failed, 0, 0).complete,
    false,
  );
  TestValidator.equals(
    "no derivative missing finding",
    failed.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-missing-acknowledgement",
    ),
    [],
  );
  TestValidator.equals(
    "no derivative empty finding",
    failed.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-empty-reference",
    ),
    [],
  );
  TestValidator.equals(
    "no derivative cardinality finding",
    failed.diagnostics.filter((diagnostic) =>
      ["graph-single-evidence-per-symbol", "graph-unique-evidence"].includes(
        diagnostic.code,
      ),
    ),
    [],
  );

  // Completeness itself prevents a successful result even if a resolver supplied no finding.
  const unresolved = TestGraph.resolved(acceptedExclusion, target);
  unresolved.resolution = {
    status: "incomplete",
    addresses: [],
    units: [],
    withdrawals: [],
    diagnostics: [],
  };
  const uncertain = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [target.id],
            resolutions: [unresolved],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "incomplete result is unsuccessful",
    uncertain.success,
    false,
  );
  TestValidator.equals(
    "incomplete resolution suppresses missing coverage",
    TestGraph.obligation(uncertain, 0, 0).missingUnitIds,
    [],
  );

  // A healthy empty reference reports the population cause once and evaluates no hosts.
  const empty = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: TestInventory.create(),
            unitIds: [],
            resolutions: [],
            uniqueEvidence: true,
            singleEvidencePerSymbol: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "one empty population finding",
    empty.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-empty-reference",
    ).length,
    1,
  );
  TestValidator.equals(
    "empty reference has no missing units",
    TestGraph.obligation(empty, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "empty reference has no cardinality finding",
    empty.diagnostics.filter((diagnostic) =>
      ["graph-single-evidence-per-symbol", "graph-unique-evidence"].includes(
        diagnostic.code,
      ),
    ),
    [],
  );
}
