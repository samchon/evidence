import { EvidenceGraphReporter, EvidenceQuery } from "@wrtnlabs/evidence";
import type { IEvidenceGraphReport } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestQueryAnalysis } from "../../internal/EvidenceTestQueryAnalysis";

/**
 * Exports independent graph obligations and safely renders untrusted target
 * labels.
 *
 * Two configured references can name the same target while retaining separate
 * policy boundaries. Graph formats must serialize the complete report
 * deterministically and escape labels so citation text cannot become Mermaid or
 * DOT syntax.
 *
 * 1. Build the graph and require two distinct boundaries, four edges, independent
 *    evidence and exclusion edges, and two evidence-review records with error
 *    review policies.
 * 2. Serialize JSON, assert it against the public graph report type, and require a
 *    repeated serialization to have identical bytes.
 * 3. Insert quotes, a line break, and Mermaid syntax into a graph node target.
 * 4. Require Mermaid and DOT to preserve relation styling while escaping the
 *    hostile text so it cannot add a new graph statement.
 */
export async function test_query_graph(): Promise<void> {
  const location = join(__dirname, `query graph ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(
    location,
    EvidenceTestQueryAnalysis.records(),
    async (directory) => {
      const analysis = await EvidenceTestQueryAnalysis.analyze(directory, 2);
      const report = EvidenceQuery.graph(analysis, directory);

      // Equal targets in two configured references retain separate obligation IDs.
      TestValidator.equals(
        "independent boundaries",
        report.boundaries.length,
        2,
      );
      TestValidator.equals(
        "independent boundary IDs",
        new Set(report.boundaries.map((entry) => entry.id)).size,
        2,
      );
      TestValidator.equals("independent edges", report.edges.length, 4);
      TestValidator.predicate(
        "effective policies",
        report.boundaries.every(
          (entry) =>
            entry.policy.requireReview && entry.policy.severity === "error",
        ),
      );
      TestValidator.equals(
        "acknowledgement kind",
        [
          report.edges.filter((edge) => edge.kind === "evidence").length,
          report.edges.filter((edge) => edge.kind === "evidenceExclude").length,
        ],
        [2, 2],
      );
      TestValidator.predicate(
        "reviews are separate",
        report.reviews.length === 2 &&
          report.reviews.every((review) => review.reviews === "evidence"),
      );

      // JSON is a deterministic and structurally validated lossless report.
      const json = EvidenceGraphReporter.json(report);
      TestValidator.equals(
        "graph JSON structure",
        typia.json.assertParse<IEvidenceGraphReport>(json),
        report,
      );
      TestValidator.equals(
        "deterministic graph JSON",
        EvidenceGraphReporter.json(report),
        json,
      );

      // Quotes, line breaks, and graph operators cannot add statements.
      const hostile = structuredClone(report);
      const node = hostile.nodes.find((candidate) => candidate.role !== "host");
      if (node === undefined) throw new Error("Missing graph identity node.");
      node.target = 'safe"]\nattacker --> victim["';
      const mermaid = EvidenceGraphReporter.mermaid(hostile);
      const dot = EvidenceGraphReporter.dot(hostile);
      TestValidator.predicate(
        "visual relation kinds",
        mermaid.includes("-.->") &&
          dot.includes('style="dashed"') &&
          dot.includes('style="dotted"'),
      );
      TestValidator.predicate(
        "Mermaid label escaped",
        !mermaid.includes("\nattacker") &&
          !mermaid.includes("attacker --> victim") &&
          mermaid.includes("&#10;"),
      );
      TestValidator.predicate(
        "DOT label escaped",
        !dot.includes("\nattacker") && dot.includes("\\nattacker"),
      );
    },
  );
}
