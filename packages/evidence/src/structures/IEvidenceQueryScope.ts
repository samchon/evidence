import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidencePopulationRole } from "../typings/EvidencePopulationRole";

/** Stable configured boundary for a query result. */
export interface IEvidenceQueryScope {
  role: EvidencePopulationRole;
  claim: number;
  reference?: number;
  name?: string;
  type: EvidenceArtifactType;
}
