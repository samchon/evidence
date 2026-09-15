import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceTargetStatement } from "./IEvidenceTargetStatement";

/**
 * A recorded review of an acknowledgement and the content of its cited scope.
 *
 * Graph evaluation pairs a review by semantic host, resolved target, and
 * acknowledgement kind. Required reviews must also carry the current
 * fingerprint of that target and its structural subtree. Matching target text
 * alone cannot compensate for an unrelated host or the wrong review kind.
 *
 * Reviews remain separate from acknowledgements because they never discharge
 * coverage. Missing fingerprints are retained for diagnostics, and semantic
 * edits can expire a previously valid review. The checker validates this record
 * and content token; it does not prove the prose true or establish who reviewed
 * it.
 *
 * @example
 *   // @evidence ../api.ts#send Exercises successful delivery.
 *   // @evidenceReview ../api.ts#send #<current-fingerprint> Checked delivery errors.
 *   // The review supplements the evidence statement instead of replacing it.
 */
export interface IEvidenceReview extends IEvidenceTargetStatement {
  /**
   * Identity of this parsed review statement.
   *
   * Resolution records join to the review table through this ID. It is separate
   * from the acknowledgement being reviewed, even when host and target
   * coincide.
   */
  id: string;

  /**
   * Acknowledgement kind validated by this review.
   *
   * Positive evidence needs a positive review; exclusions need exclusion
   * reviews. The wrong kind produces a pairing finding rather than satisfying
   * review policy.
   */
  reviews: EvidenceAcknowledgementKind;

  /**
   * Content fingerprint recorded by the review author, when supplied.
   *
   * Omission remains a parseable review state. A reference requiring review
   * reports a missing token or a stale token against the current target
   * fingerprint.
   */
  fingerprint?: string;

  /**
   * Nonempty prose describing the recorded verification.
   *
   * Tag parsing requires explanatory text. Graph policy checks pairing and
   * content freshness without judging whether the described verification
   * actually occurred.
   */
  description: string;
}
