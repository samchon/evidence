import type { IEvidenceTargetResolution } from "./IEvidenceTargetResolution";

/**
 * Prepared target resolution for an acknowledgement in one reference inventory.
 *
 * Resolution is retained separately from accepted edges because an invalid,
 * missing, or ambiguous target must still produce a diagnostic. The same source
 * declaration can resolve differently across independent reference boundaries.
 */
export interface IEvidenceGraphResolution {
  /**
   * Identity of the acknowledgement whose target was resolved.
   *
   * The evaluator uses it to find the prepared result for that source statement.
   */
  declarationId: string;

  /**
   * Successful or failed resolution within the current reference boundary.
   *
   * Failure details remain available even when no accepted edge can be created.
   */
  resolution: IEvidenceTargetResolution;
}
