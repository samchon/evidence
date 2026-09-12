import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { IEvidenceCheckObligation } from "./IEvidenceCheckObligation";

/** Serializable check state for one configured claim. */
export interface IEvidenceCheckClaim {
  claim: number;
  name?: string;
  type: EvidenceArtifactType;
  active: boolean;
  complete: boolean;
  obligations: IEvidenceCheckObligation[];
}
