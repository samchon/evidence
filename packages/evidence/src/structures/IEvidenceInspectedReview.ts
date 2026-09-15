import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceReview } from "./IEvidenceReview";

/**
 * Incoming review whose target scope contains an inspected reference candidate.
 *
 * This presents the review's source and resolution outcome separately from
 * accepted acknowledgements. A resolved review still requires valid pairing and
 * a current fingerprint; its presence here does not itself prove freshness or
 * create coverage.
 */
export interface IEvidenceInspectedReview {
  /**
   * Authored claim index containing the review statement.
   *
   * Review lookup remains within this claim's reference boundaries.
   */
  claim: number;

  /**
   * Authored reference index against which the review target was resolved.
   *
   * The same review can have different outcomes in independently configured
   * references.
   */
  reference: number;

  /**
   * Extracted review annotation with its expected fingerprint and description.
   *
   * The original location permits repair of a stale or incorrectly paired
   * review.
   */
  review: IEvidenceReview;

  /**
   * Documentation carrier owning the review.
   *
   * Pairing uses carrier context so an unrelated host's review cannot validate
   * a citation.
   */
  host: IEvidenceHost;

  /**
   * Target-resolution outcome prepared for this review.
   *
   * It describes target identity, independently of freshness or acknowledgement
   * acceptance.
   */
  status: EvidenceTargetResolutionStatus;

  /**
   * Semantic candidates returned for the review's exact target.
   *
   * These can be ancestors of inspected units and do not represent accepted
   * coverage.
   */
  unitIds: string[];
}
