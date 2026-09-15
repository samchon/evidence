import { EvidGraph, EvidPrismaAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Keeps rejected and unreadable Prisma schemas incomplete until repair.
 *
 * A failing schema remains an active graph participant so coverage cannot pass from a reduced population.
 *
 * 1. Analyze rejected and unreadable schemas and inspect their diagnostics.
 * 2. Evaluate their active claim in the graph and require failure.
 * 3. Repair the schema and require complete recovery.
 */
export async function test_prisma_failures(): Promise<void> {
  const adapter = new EvidPrismaAdapter();
  const broken = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "prisma/schema.prisma",
      "model Sale {\n  id String @id\n",
    ),
  );

  TestValidator.equals("rejected schema is incomplete", broken.complete, false);
  TestValidator.equals(
    "rejected schema has no guessed units",
    broken.units,
    [],
  );
  TestValidator.predicate(
    "parser rejection is actionable",
    broken.diagnostics.some(
      (diagnostic) => diagnostic.code === "prisma-parse-failed",
    ),
  );

  // An incomplete claim remains active and cannot pass as an empty host population.
  const graph = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: broken,
        unitIds: [],
        references: [],
      },
    ],
  });
  const claim = graph.claims[0];
  if (claim === undefined)
    throw new Error("Missing rejected Prisma claim result.");
  TestValidator.equals("rejected claim remains active", claim.active, true);
  TestValidator.equals(
    "rejected claim remains incomplete",
    claim.complete,
    false,
  );
  TestValidator.equals("rejected claim fails the graph", graph.success, false);

  // Repairing the same schema produces a complete parser inventory on the next run.
  const repaired = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "prisma/schema.prisma",
      "model Sale {\n  id String @id\n}\n",
    ),
  );
  TestValidator.equals("repaired schema is complete", repaired.complete, true);
  TestValidator.equals(
    "repaired schema restores its denominator",
    repaired.units.map((unit) => unit.id),
    ["prisma:Sale", "prisma:Sale.id"],
  );

  const unreadable = await adapter.analyze(
    EvidTestSourceSnapshot.fail(
      EvidTestSourceSnapshot.create("prisma/available.prisma", ""),
      {
        code: "path-unreadable",
        path: "/project/prisma/missing.prisma",
        message: "The selected Prisma schema file could not be read.",
      },
    ),
  );
  TestValidator.equals(
    "source failure is incomplete",
    unreadable.complete,
    false,
  );
  TestValidator.equals(
    "source failure remains visible",
    unreadable.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "source-path-unreadable"],
  );
}
