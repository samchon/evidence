import type { EvidAcknowledgementKind } from "../typings/EvidAcknowledgementKind";
import type { EvidTargetResolutionStatus } from "../typings/EvidTargetResolutionStatus";
import type { IEvidReview } from "./IEvidReview";

/**
 * Review relation exported separately from accepted acknowledgement edges.
 *
 * Target-resolution candidates become endpoints even when the result is ambiguous.
 * The status describes identity lookup, not review freshness or successful pairing;
 * no review relation creates coverage by itself.
 */
export interface IEvidGraphExportReview {
  /**
   * Review identity qualified by its independent obligation boundary.
   *
   * One source review can appear in several references with distinct resolution outcomes.
   */
  id: string;

  /**
   * Claim/reference obligation against which the review was resolved.
   *
   * Its policy determines how pairing and freshness affect evaluation.
   */
  boundaryId: string;

  /**
   * Acknowledgement form this review intends to validate.
   *
   * Matching also requires the relevant host, target scope, and fingerprint conditions.
   */
  reviews: EvidAcknowledgementKind;

  /**
   * Original review statement and its authored validation metadata.
   *
   * Source coordinates and description remain available for stale-review repair.
   */
  review: IEvidReview;

  /**
   * Resolution outcome for the review's authored target.
   *
   * Resolved status establishes target identity without claiming freshness or coverage.
   */
  status: EvidTargetResolutionStatus;

  /**
   * Boundary-qualified claim or standalone-carrier endpoints owning the review.
   *
   * Physical host ownership remains represented even without a selected semantic subject.
   */
  sourceNodeIds: string[];

  /**
   * Boundary-qualified reference nodes returned as target candidates.
   *
   * Ambiguous resolution can retain several endpoints; failures without candidates
   * leave the collection empty.
   */
  targetNodeIds: string[];
}
