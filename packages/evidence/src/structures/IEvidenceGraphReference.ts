import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceGraphResolution } from "./IEvidenceGraphResolution";
import type { IEvidenceGraphReviewResolution } from "./IEvidenceGraphReviewResolution";
import type { IEvidenceInventory } from "./IEvidenceInventory";

/** One reference population and the claim declarations applicable to it. */
export interface IEvidenceGraphReference {
  severity: EvidenceSeverity;
  inventory: IEvidenceInventory;
  /** Semantic identities that form this reference's denominator. */
  unitIds: string[];
  /** Resolutions for declarations whose target syntax belongs to this reference. */
  resolutions: IEvidenceGraphResolution[];
  /** Resolutions for reviews whose target syntax belongs to this reference. */
  reviewResolutions?: IEvidenceGraphReviewResolution[];
  /** Refuse exclusions for this reference. */
  noEvidenceExclude?: boolean;
  /** Allow at most one distinct positive claim host per selected unit. */
  uniqueEvidence?: boolean;
  /** Require each selected claim host to cite exactly one selected unit. */
  singleEvidencePerSymbol?: boolean;
  /** Require each selected claim host to answer every selected Markdown item. */
  checklist?: boolean;
  /** Require each accepted acknowledgement to carry a current matching review. */
  requireReview?: boolean;
}
