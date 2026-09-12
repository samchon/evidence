import type { IEvidenceGraphObligation } from "./IEvidenceGraphObligation";

/** Evaluation state retained for one configured claim. */
export interface IEvidenceGraphClaimResult {
  claim: number;
  active: boolean;
  /** Whether the active claim population was materialized completely. */
  complete: boolean;
  obligations: IEvidenceGraphObligation[];
}
