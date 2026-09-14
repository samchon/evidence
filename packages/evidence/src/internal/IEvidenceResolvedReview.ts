import type { IEvidenceReview } from "../structures/IEvidenceReview";

/**
 * A review annotation paired with its resolved reference target and claim hosts.
 *
 * Reviews retain the authored record so reporting can distinguish a missing
 * review from an invalid target without re-parsing source text.
 */
export interface IEvidenceResolvedReview {
  /** Original review declaration and source position. */
  review: IEvidenceReview;

  /** Claim units whose structural scope contains the review host. */
  hostUnitIds: string[];

  /** Reference unit named by the review target. */
  targetUnitId: string;
}
