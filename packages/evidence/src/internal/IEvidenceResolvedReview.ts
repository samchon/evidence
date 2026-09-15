import type { IEvidenceReview } from "../structures/IEvidenceReview";

/**
 * A review annotation paired with its resolved reference target and claim
 * hosts.
 *
 * Reviews retain the authored record so reporting can distinguish a missing
 * review from an invalid target without re-parsing source text.
 */
export interface IEvidenceResolvedReview {
  /**
   * Original review declaration and source position.
   *
   * Reporting retains the authored annotation so an invalid review target can
   * be distinguished from an absent review without reparsing its source file.
   */
  review: IEvidenceReview;

  /**
   * Claim units whose structural scope contains the review host.
   *
   * One review declaration can apply to multiple selected descendants that
   * share its structural host position.
   */
  hostUnitIds: string[];

  /**
   * Reference unit named by the review target.
   *
   * The resolver assigns this identity after proving the target is unique
   * within the configured reference population.
   */
  targetUnitId: string;
}
