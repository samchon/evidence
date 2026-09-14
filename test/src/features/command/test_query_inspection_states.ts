import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceQuery } from "../../../../packages/evidence/src/graph/EvidenceQuery";
import type { IEvidenceCheckAnalysis } from "../../../../packages/evidence/src/structures/IEvidenceCheckAnalysis";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestQueryAnalysis } from "../../internal/TestQueryAnalysis";

/** Explains review expiry, ambiguity, withdrawal, and incomplete target analysis. */
export async function test_query_inspection_states(): Promise<void> {
  const location = join(__dirname, `query states ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    TestQueryAnalysis.records(),
    async (directory) => {
      const analysis = await TestQueryAnalysis.analyze(directory);
      const target = requireReviewedTarget(analysis, directory);

      // The inspection pairs the authored stale hash with the current requested hash.
      const inspected = await EvidenceQuery.inspect(
        analysis,
        directory,
        target,
      );
      const resolved = inspected.inspections[0];
      if (resolved === undefined) throw new Error("Missing inspection result.");
      const unit = resolved.units[0];
      if (unit === undefined || unit.fingerprint === undefined)
        throw new Error("Missing reviewed inspection result.");
      const fingerprint = unit.fingerprint.fingerprint;
      TestValidator.predicate("target host range", unit.hosts.length !== 0);
      TestValidator.equals(
        "stale authored review",
        resolved.reviews.map((review) => review.review.fingerprint),
        ["0000000"],
      );
      TestValidator.predicate(
        "current review fingerprint",
        analysis.report.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "graph-stale-review" &&
            (diagnostic.message.includes(`#${fingerprint}`) ||
              diagnostic.repair.includes(`#${fingerprint}`)),
        ),
      );
      TestValidator.equals(
        "incoming acknowledgement",
        resolved.acknowledgements.length,
        1,
      );
      const acknowledgement = resolved.acknowledgements[0];
      if (acknowledgement === undefined)
        throw new Error("Missing inspected acknowledgement.");
      TestValidator.equals(
        "annotation and host provenance",
        acknowledgement.declaration.location.file,
        acknowledgement.host.file,
      );

      // Two distinct identities under the same address remain visibly ambiguous.
      const ambiguous = structuredClone(analysis);
      const inventory = requireReferenceInventory(ambiguous);
      const original = inventory.units.find(
        (candidate) => candidate.id === unit.item.unitId,
      );
      if (original === undefined)
        throw new Error("Missing query fixture unit.");
      const duplicate = structuredClone(original);
      duplicate.id += ":duplicate";
      duplicate.sites = duplicate.sites.map((site) => ({
        ...site,
        id: site.id + ":duplicate",
      }));
      inventory.units.push(duplicate);
      inventory.addresses.push(
        ...inventory.addresses
          .filter((address) => address.unitId === original.id)
          .map((address) => ({ ...address, unitId: duplicate.id })),
      );
      requireReference(ambiguous).unitIds.push(duplicate.id);
      const collision = await EvidenceQuery.inspect(
        ambiguous,
        directory,
        target,
      );
      TestValidator.equals(
        "ambiguous status",
        collision.inspections[0]?.status,
        "ambiguous",
      );

      // Withdrawal and incomplete metadata take precedence over apparent target shape.
      const hidden = structuredClone(analysis);
      const hiddenUnit = requireReferenceInventory(hidden).units.find(
        (candidate) => candidate.id === original.id,
      );
      if (hiddenUnit === undefined)
        throw new Error("Missing hidden query unit.");
      const hiddenSite = hiddenUnit.sites[0];
      if (hiddenSite === undefined)
        throw new Error("Missing hidden query site.");
      hiddenUnit.withdrawals.push({
        tag: "hidden",
        location: {
          file: hiddenSite.file,
          range: hiddenSite.range,
        },
      });
      const withdrawn = await EvidenceQuery.inspect(hidden, directory, target);
      TestValidator.equals(
        "hidden status",
        referenceInspection(withdrawn)?.status,
        "hidden",
      );
      TestValidator.equals("hidden exit", withdrawn.exitCode, 1);

      const incomplete = structuredClone(analysis);
      requireReferenceInventory(incomplete).complete = false;
      const interrupted = await EvidenceQuery.inspect(
        incomplete,
        directory,
        target,
      );
      TestValidator.equals(
        "incomplete status",
        referenceInspection(interrupted)?.status,
        "incomplete",
      );
      TestValidator.equals("incomplete exit", interrupted.exitCode, 2);
    },
  );
}

function referenceInspection(
  report: Awaited<ReturnType<typeof EvidenceQuery.inspect>>,
):
  | Awaited<ReturnType<typeof EvidenceQuery.inspect>>["inspections"][number]
  | undefined {
  return report.inspections.find(
    (inspection) => inspection.scope.role === "reference",
  );
}

function requireReviewedTarget(
  analysis: IEvidenceCheckAnalysis,
  directory: string,
): string {
  const item = EvidenceQuery.list(analysis, directory).items.find(
    (candidate) =>
      candidate.scope.role === "reference" &&
      candidate.name === "member.with.dots" &&
      candidate.aliases.some((alias) => alias.includes("%EA%B3%B5%EC%9A%A9")),
  );
  if (item === undefined) throw new Error("Missing reviewed query target.");
  return (
    item.aliases.find((alias) => alias.includes("%EA%B3%B5%EC%9A%A9")) ??
    item.target
  );
}

function requireReference(
  analysis: IEvidenceCheckAnalysis,
): IEvidenceCheckAnalysis["graphInput"]["claims"][number]["references"][number] {
  const claim = analysis.graphInput.claims[0];
  if (claim === undefined) throw new Error("Missing query claim.");
  const reference = claim.references[0];
  if (reference === undefined) throw new Error("Missing query reference.");
  return reference;
}

function requireReferenceInventory(
  analysis: IEvidenceCheckAnalysis,
): IEvidenceCheckAnalysis["graphInput"]["claims"][number]["references"][number]["inventory"] {
  return requireReference(analysis).inventory;
}
