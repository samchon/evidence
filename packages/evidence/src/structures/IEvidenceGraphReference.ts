import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceGraphResolution } from "./IEvidenceGraphResolution";
import type { IEvidenceInventory } from "./IEvidenceInventory";

/** One reference population and the claim declarations applicable to it. */
export interface IEvidenceGraphReference {
  severity: EvidenceSeverity;
  inventory: IEvidenceInventory;
  /** Semantic identities that form this reference's denominator. */
  unitIds: string[];
  /** Resolutions for declarations whose target syntax belongs to this reference. */
  resolutions: IEvidenceGraphResolution[];
  noEvidenceExclude?: boolean;
}
