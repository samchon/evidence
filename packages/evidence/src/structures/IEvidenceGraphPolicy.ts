import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

/** Effective policy for one independent claim/reference obligation. */
export interface IEvidenceGraphPolicy {
  severity: EvidenceSeverity;
  noEvidenceExclude: boolean;
  uniqueEvidence: boolean;
  singleEvidencePerSymbol: boolean;
  checklist: boolean;
  requireReview: boolean;
}
