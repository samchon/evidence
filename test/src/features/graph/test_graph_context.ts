import { TestValidator } from "@nestia/e2e";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import type { IEvidenceGraphInput } from "../../../../packages/evidence/src/structures/IEvidenceGraphInput";
import { TestGraph } from "../../internal/TestGraph";
import { TestInventory } from "../../internal/TestInventory";

/**
 * Keeps graph state isolated across repeated evaluations and reference policies.
 *
 * One exclusion covers its permitted reference while a repeated reference forbids it; input and output mutation must not alter later evaluations.
 */
export async function test_graph_context(): Promise<void> {
  const inventory = TestInventory.create();
  const unit = TestInventory.unit(
    inventory,
    "claim",
    ["Claim"],
    "type",
    "export const first = 1, second = 2;",
  );
  const host = TestInventory.host(
    inventory,
    "host",
    unit.sites[0]?.id ?? "",
    [unit.id],
    "/** Shared documentation. */",
  );
  const exclusion = TestGraph.declaration(
    inventory,
    "exclude",
    host,
    "evidenceExclude",
    "target",
  );
  const reference = TestInventory.create();
  const target = TestInventory.unit(
    reference,
    "target",
    ["Target"],
    "type",
    "export class Box { value = 1; }",
  );
  const input: IEvidenceGraphInput = {
    claims: [
      {
        severity: "error",
        inventory,
        unitIds: [unit.id],
        references: [false, true].map((noEvidenceExclude) => ({
          severity: "error",
          inventory: reference,
          unitIds: [target.id],
          resolutions: [TestGraph.resolved(exclusion, target)],
          noEvidenceExclude,
        })),
      },
    ],
  };
  const graph = new EvidenceGraph(input);
  const first = graph.evaluate();
  const baseline = structuredClone(first);

  TestValidator.equals(
    "permitted exclusion",
    TestGraph.obligation(first, 0, 0).coveredUnitIds,
    [target.id],
  );
  TestValidator.equals(
    "independent prohibition",
    TestGraph.obligation(first, 0, 1).missingUnitIds,
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
    new EvidenceGraph(input).evaluate(),
    { success: true, claims: [], diagnostics: [] },
  );
}
