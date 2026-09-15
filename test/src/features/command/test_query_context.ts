import { EvidQuery } from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestQueryAnalysis } from "../../internal/TestQueryAnalysis";

/**
 * Keeps reusable query contexts independent of caller mutations and concurrent resolution state.
 *
 * Repeated reference entries retain separate configured boundaries even when a
 * caller mutates the analysis and output objects used to create the query. The
 * facade must preserve its own indexes while one inspection resolves and another
 * reports a missing target.
 *
 * 1. Create a query from the shared fixture and capture baseline list and graph reports.
 * 2. Erase caller-owned claims, report entries, listed items, diagnostics, and graph
 *    nodes; require subsequent list and graph calls to equal their baselines.
 * 3. Inspect a known target and an absent target concurrently. Require the known
 *    result to resolve through reference indexes 4 and 5 while the absent result
 *    remains unresolved.
 * 4. Mutate the returned inspection and require a later inspection to reproduce
 *    the unmodified baseline.
 */
export async function test_query_context(): Promise<void> {
  await TestFileSystem.experiment(
    join(__dirname, `query context ${randomUUID()}`),
    TestQueryAnalysis.records(),
    async (directory) => {
      const analysis = await TestQueryAnalysis.analyze(directory, 2);
      const query = new EvidQuery(analysis, directory);
      const listing = query.list();
      const baseline = structuredClone(listing);
      const target = listing.items.find(
        (item) =>
          item.scope.role === "reference" && item.selection === "selected",
      )?.target;
      if (target === undefined)
        throw new Error("Missing selected reference target.");
      const graph = query.graph();
      const graphBaseline = structuredClone(graph);

      // Caller mutations cannot invalidate the facade's population indexes.
      analysis.graphInput.claims.length = 0;
      analysis.graph.claims.length = 0;
      analysis.report.claims.length = 0;
      listing.items.length = 0;
      listing.diagnostics.length = 0;
      graph.nodes.length = 0;
      TestValidator.equals("owned listing", query.list(), baseline);
      TestValidator.equals("owned graph", query.graph(), graphBaseline);

      // Concurrent valid and missing targets must not share resolution state.
      const [resolved, missing] = await Promise.all([
        query.inspect(target),
        query.inspect("contracts/absent.ts#Missing"),
      ]);
      TestValidator.equals(
        "independent reference entries",
        resolved.inspections.map((entry) => entry.scope.reference),
        [4, 5],
      );
      TestValidator.predicate(
        "known target resolves",
        resolved.inspections.every((entry) => entry.status === "resolved"),
      );
      TestValidator.predicate(
        "missing target stays unresolved",
        missing.inspections.some((entry) => entry.status !== "resolved"),
      );
      const inspectedBaseline = structuredClone(resolved);
      resolved.inspections.length = 0;
      TestValidator.equals(
        "owned inspection",
        await query.inspect(target),
        inspectedBaseline,
      );
    },
  );
}
