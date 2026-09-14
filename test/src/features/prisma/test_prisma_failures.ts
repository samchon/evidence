import { EvidenceGraph, EvidencePrismaAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps rejected or unreadable Prisma schemas incomplete until repaired. */
export async function test_prisma_failures(): Promise<void> {
  const adapter = new EvidencePrismaAdapter();
  const broken = await adapter.analyze(
    TestSourceSnapshot.create(
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
  const graph = EvidenceGraph.evaluate({
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
    TestSourceSnapshot.create(
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
    TestSourceSnapshot.fail(
      TestSourceSnapshot.create("prisma/available.prisma", ""),
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
