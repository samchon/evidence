import { EvidGraph } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Applies host eligibility and distinguishes failed analysis from empty or
 * uncovered populations.
 *
 * Positive evidence requires a selected semantic claim host, while an eligible
 * exclusion carrier can lie outside the symbol selection. Incomplete analysis
 * must stop derived coverage and cardinality findings that would assume a known
 * denominator; reviews alone must never supply missing acknowledgement.
 *
 * 1. Put evidence and an exclusion on an unselected public carrier; require one
 *    out-of-scope-host finding for positive evidence and coverage from the
 *    exclusion.
 * 2. Set an explicit empty exclusion-host selection and require the target to
 *    remain missing.
 * 3. Add a review without any prepared acknowledgement resolution and require no
 *    coverage.
 * 4. Fail reference discovery with cardinality policies enabled; require
 *    incomplete obligation state and no derivative missing, empty-reference, or
 *    cardinality findings.
 * 5. Supply an incomplete resolution with no diagnostic and require overall
 *    failure while suppressing derived missing-unit results.
 * 6. Supply a complete empty reference and require exactly one empty-reference
 *    finding, no missing units, and no per-host cardinality findings.
 */
export async function test_graph_hosts_and_failures(): Promise<void> {
  const reference = EvidTestInventory.create();
  const target = EvidTestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const claim = EvidTestInventory.create();
  const selected = EvidTestInventory.unit(
    claim,
    "selected",
    ["Selected"],
    "type",
    "export const first = 1, second = 2;",
  );
  const carrier = EvidTestInventory.unit(
    claim,
    "carrier",
    ["Carrier"],
    "property",
    "export const unrelated = 3;",
  );
  const carrierHost = EvidTestInventory.host(
    claim,
    "carrier-host",
    carrier.sites[0]?.id ?? "",
    [carrier.id],
    "/** Class documentation. */",
  );
  const misplacedEvid = EvidTestGraph.declaration(
    claim,
    "misplaced-evidence",
    carrierHost,
    "evidence",
    "target",
  );
  const acceptedExclusion = EvidTestGraph.declaration(
    claim,
    "accepted-exclusion",
    carrierHost,
    "evidenceExclude",
    "target",
  );

  const carrierResult = EvidGraph.evaluate({
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
              EvidTestGraph.resolved(misplacedEvid, target),
              EvidTestGraph.resolved(acceptedExclusion, target),
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
    EvidTestGraph.obligation(carrierResult, 0, 0).missingUnitIds,
    [],
  );

  // An explicit empty carrier selection refuses the same exclusion and leaves coverage missing.
  const restricted = EvidGraph.evaluate({
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
            resolutions: [EvidTestGraph.resolved(acceptedExclusion, target)],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "restricted carrier",
    EvidTestGraph.obligation(restricted, 0, 0).missingUnitIds,
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
  const reviewOnly = EvidGraph.evaluate({
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
    EvidTestGraph.obligation(reviewOnly, 0, 0).missingUnitIds,
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
  const failed = EvidGraph.evaluate({
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
            uniqueEvid: true,
            singleEvidPerSymbol: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "failed obligation incomplete",
    EvidTestGraph.obligation(failed, 0, 0).complete,
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
  const unresolved = EvidTestGraph.resolved(acceptedExclusion, target);
  unresolved.resolution = {
    status: "incomplete",
    addresses: [],
    units: [],
    withdrawals: [],
    diagnostics: [],
  };
  const uncertain = EvidGraph.evaluate({
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
    EvidTestGraph.obligation(uncertain, 0, 0).missingUnitIds,
    [],
  );

  // A healthy empty reference reports the population cause once and evaluates no hosts.
  const empty = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [selected.id],
        references: [
          {
            severity: "error",
            inventory: EvidTestInventory.create(),
            unitIds: [],
            resolutions: [],
            uniqueEvid: true,
            singleEvidPerSymbol: true,
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
    EvidTestGraph.obligation(empty, 0, 0).missingUnitIds,
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
