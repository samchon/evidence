import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/** Serializable counts for one configured claim/reference obligation. */
export interface IEvidenceCheckObligation {
  claim: number;
  reference: number;
  type: EvidenceArtifactType;
  severity: EvidenceActiveSeverity;
  active: boolean;
  complete: boolean;
  units: number;
  coveredUnits: number;
  missingUnits: number;
}
