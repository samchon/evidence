import type { EvidSeverity } from "../typings/EvidSeverity";
import type { IEvidGraphResolution } from "./IEvidGraphResolution";
import type { IEvidGraphReviewResolution } from "./IEvidGraphReviewResolution";
import type { IEvidInventory } from "./IEvidInventory";

/**
 * One materialized target population and the policies governing its
 * acknowledgements.
 *
 * Target resolutions join claim statements to units in this inventory. Selected
 * IDs define the denominator, while real ancestors remain usable as aggregate
 * scopes. Review resolutions remain separate because reviews validate evidence
 * without contributing coverage.
 *
 * Every record is an independent obligation, even when another reference has
 * the same inventory and selectors. An exclusion can cover a permissive
 * reference while leaving a repeated, exclusion-forbidding reference missing.
 */
export interface IEvidGraphReference {
  /**
   * Original zero-based reference position within its claim.
   *
   * Omission uses the current array position for direct graph input. Explicit
   * indices preserve attribution after inactive references have been filtered.
   */
  index?: number;

  /**
   * Effective diagnostic severity for this reference.
   *
   * Off skips the obligation. An active severity applies to findings attributed
   * to its inventory, resolutions, coverage, and policy checks.
   */
  severity: EvidSeverity;

  /**
   * Captured target declarations and their public addresses.
   *
   * Evaluation reconciles the inventory before selection. Incomplete extraction
   * cannot supply a passing denominator even if all written citations resolve.
   */
  inventory: IEvidInventory;

  /**
   * Semantic identities required by this reference's selector.
   *
   * Aliases do not duplicate requirements. Structural ancestors can be resolved
   * as aggregate targets without becoming extra selected identities.
   */
  unitIds: string[];

  /**
   * Resolution outcomes for applicable acknowledgement statements.
   *
   * Each entry identifies a claim declaration and its target state in this
   * population. The graph checks consistency before accepting a coverage edge.
   */
  resolutions: IEvidGraphResolution[];

  /**
   * Resolution outcomes for applicable review statements.
   *
   * Omission supplies no precomputed review resolutions. Review pairing uses
   * these outcomes independently of acknowledgement resolution and coverage.
   */
  reviewResolutions?: IEvidGraphReviewResolution[];

  /**
   * Whether this obligation refuses exclusion acknowledgements.
   *
   * Omission permits eligible exclusions. A refused exclusion produces a
   * finding and leaves its target needing positive evidence in this reference
   * only.
   */
  noEvidExclude?: boolean;

  /**
   * Whether each selected unit permits at most one positive semantic host.
   *
   * Omission imposes no host limit. Repeated tags and overload positions do not
   * create extra hosts; exclusions do not count as positive ownership.
   */
  uniqueEvid?: boolean;

  /**
   * Whether every selected claim host must cite exactly one selected unit.
   *
   * Omission leaves cardinality unrestricted. Untagged hosts count as zero,
   * repeated citations count once per target, and aggregates count each
   * selected descendant.
   */
  singleEvidPerSymbol?: boolean;

  /**
   * Whether each selected host must answer every selected Markdown item.
   *
   * Omission uses ordinary population coverage. Checklist evidence answers only
   * the named item, while permitted exclusions retain host-local descendant
   * scope.
   */
  checklist?: boolean;

  /**
   * Whether accepted acknowledgements need a current matching review.
   *
   * Omission leaves review optional. Pairing requires the same semantic host,
   * target, and kind, followed by a fingerprint match for the cited content
   * scope.
   */
  requireReview?: boolean;
}
