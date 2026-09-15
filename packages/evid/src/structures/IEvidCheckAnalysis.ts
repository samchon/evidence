import type { IEvidCheckReport } from "./IEvidCheckReport";
import type { IEvidGraphInput } from "./IEvidGraphInput";
import type { IEvidGraphResult } from "./IEvidGraphResult";

/**
 * Captured inputs, graph evaluation, and report from one checker invocation.
 *
 * `EvidChecker.analyze` returns this when callers need queryable context in
 * addition to a check status. List, inspection, and graph queries can explain the
 * same source snapshots without reloading files that may have changed afterward.
 *
 * Each projection has a distinct purpose: graph input retains inventories and
 * policy, graph result retains independent obligations and findings, and report
 * supplies command-facing counts and exit status.
 */
export interface IEvidCheckAnalysis {
  /**
   * Materialized populations and resolutions supplied to graph evaluation.
   *
   * Queries use the retained inventories to recover unit identities, source
   * locations, aliases, and the policy behind an evaluated obligation.
   */
  graphInput: IEvidGraphInput;

  /**
   * Coverage and review evaluation of the captured graph input.
   *
   * Independent claim/reference results remain available for inspection, even
   * when several obligations contribute to one command-level count.
   */
  graph: IEvidGraphResult;

  /**
   * Command-facing projection of the same analysis.
   *
   * This supplies counts, diagnostics, status, and exit code without a second
   * evaluation. Reporters render it rather than interpreting adapter records.
   */
  report: IEvidCheckReport;
}
