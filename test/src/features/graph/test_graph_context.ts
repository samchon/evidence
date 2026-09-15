import { EvidGraph } from "evid";
import type { IEvidGraphInput } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Keeps graph state isolated across repeated evaluations and reference policies.
 *
 * One claim host excludes a target shared by two references with different
 * exclusion policies. Coverage must remain local to each obligation, and neither
 * caller mutation nor prior diagnostics may affect a subsequent evaluation.
 *
 * 1. Evaluate the shared exclusion against both references and verify that:
 *    - The permissive reference covers the target.
 *    - The strict reference keeps it missing with one forbidden-exclusion finding.
 * 2. Save the result, then clear the caller's input and the returned claim and
 *    diagnostic arrays. Reevaluating the existing facade must reproduce the
 *    saved result without lost coverage or duplicated diagnostics.
 * 3. Construct another facade from the now-empty input and require an empty,
 *    successful graph, proving that each facade captures its own input.
 */
export async function test_graph_context(): Promise<void> {
  const inventory = EvidTestInventory.create();
  const unit = EvidTestInventory.unit(
    inventory,
    "claim",
    ["Claim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const host = EvidTestInventory.host(
    inventory,
    "host",
    unit.sites[0]?.id ?? "",
    [unit.id],
    "/** Shared documentation. */",
  );
  const exclusion = EvidTestGraph.declaration(
    inventory,
    "exclude",
    host,
    "evidenceExclude",
    "target",
  );
  const reference = EvidTestInventory.create();
  const target = EvidTestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const input: IEvidGraphInput = {
    claims: [
      {
        severity: "error",
        inventory,
        unitIds: [unit.id],
        references: [false, true].map((noEvidExclude) => ({
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [EvidTestGraph.resolved(exclusion, target)],
          noEvidExclude,
        })),
      },
    ],
  };
  const graph = new EvidGraph(input);
  const first = graph.evaluate();
  const baseline = structuredClone(first);

  TestValidator.equals(
    "permitted exclusion",
    EvidTestGraph.obligation(first, 0, 0).coveredUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "independent prohibition",
    EvidTestGraph.obligation(first, 0, 1).missingUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "one policy finding",
    first.diagnostics.filter(
      (entry) => entry.code === "graph-forbidden-exclusion",
    ).length,
    1,
  );

  // Captured inputs and fresh evaluators prevent caller mutation and duplicate diagnostics.
  input.claims.length = 0;
  first.claims.length = 0;
  first.diagnostics.length = 0;
  TestValidator.equals("fresh graph evaluation", graph.evaluate(), baseline);
  TestValidator.equals(
    "separate empty graph",
    new EvidGraph(input).evaluate(),
    { success: true, claims: [], diagnostics: [] },
  );
}
