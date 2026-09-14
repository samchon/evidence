import type { IEvidenceTargetResolution } from "./IEvidenceTargetResolution";

/**
 * Prepared reference-target resolution for a review statement.
 *
 * Reviews resolve through the same target grammar as acknowledgements but remain
 * separate records: matching a review validates a paired citation and never
 * creates coverage by itself. Failed resolution is retained for diagnostics.
 */
export interface IEvidenceGraphReviewResolution {
  /**
   * Identity of the review whose target was resolved.
   *
   * This keeps reviews distinguishable when several statements name one target.
   */
  reviewId: string;

  /**
   * Resolution outcome in the relevant reference inventory.
   *
   * A successful target still requires acknowledgement pairing and fingerprint
   * validation before the review can satisfy review policy.
   */
  resolution: IEvidenceTargetResolution;
}
