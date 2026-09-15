import type { IEvidenceGraphObligation } from "./IEvidenceGraphObligation";

/**
 * Graph evaluation result for a claim and its independent references.
 *
 * This retains activation and extraction state without carrying display labels
 * from configuration. `EvidenceCheckProgrammer` later joins it to the plan to
 * produce a report. A complete claim population does not imply complete or
 * covered reference obligations.
 */
export interface IEvidenceGraphClaimResult {
  /**
   * Authored claim index identifying this result.
   *
   * It remains stable when planning filters disabled configuration entries.
   */
  claim: number;

  /**
   * Whether the claim participates in graph evaluation.
   *
   * Inactive claims do not impose active reference coverage requirements.
   */
  active: boolean;

  /**
   * Whether the active claim population was materialized completely.
   *
   * Reference extraction and target resolution have their own completeness
   * state on each obligation, so callers must inspect both levels.
   */
  complete: boolean;

  /**
   * Results for the claim's planned reference boundaries.
   *
   * Each entry keeps its own coverage ledger even when references share units.
   */
  obligations: IEvidenceGraphObligation[];
}
