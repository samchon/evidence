import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceGraphClaimResult } from "./IEvidenceGraphClaimResult";

/**
 * Serializable outcome of one materialized graph evaluation.
 *
 * Claims retain their independent reference ledgers, while diagnostics collect
 * the findings needed to explain failures across the graph. The result contains
 * policy evaluation data; command status, severity aggregation, and rendering
 * are supplied by later reporting layers.
 *
 * A result succeeds only when every active boundary is complete and no findings
 * remain. Merely obtaining an empty missing-unit list from partial input does
 * not establish success.
 */
export interface IEvidenceGraphResult {
  /**
   * Whether all active evaluation boundaries are complete and finding-free.
   *
   * Inactive claims do not make the graph incomplete. Any retained diagnostic
   * or active incomplete obligation prevents this flag from becoming true.
   */
  success: boolean;

  /**
   * Per-claim outcomes with their independent reference obligations.
   *
   * The original claim indices remain in each record for attribution. Repeated
   * references are preserved rather than merged into one aggregate coverage
   * set.
   */
  claims: IEvidenceGraphClaimResult[];

  /**
   * Deduplicated findings from extraction integrity and policy evaluation.
   *
   * Finalization includes findings that depend on cross-reference
   * participation. Consumers can render them without rerunning the graph
   * traversal.
   */
  diagnostics: IEvidenceDiagnostic[];
}
