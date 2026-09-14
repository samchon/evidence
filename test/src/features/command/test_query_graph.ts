import { EvidenceGraphReporter, EvidenceQuery } from "@wrtnlabs/evidence";
import type { IEvidenceGraphReport } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestQueryAnalysis } from "../../internal/TestQueryAnalysis";

/** Exports independent obligations and renders untrusted labels as graph data. */
export async function test_query_graph(): Promise<void> {
  const location = join(__dirname, `query graph ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    TestQueryAnalysis.records(),
    async (directory) => {
      const analysis = await TestQueryAnalysis.analyze(directory, 2);
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
