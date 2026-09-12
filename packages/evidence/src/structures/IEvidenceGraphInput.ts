import type { IEvidenceGraphClaim } from "./IEvidenceGraphClaim";

/** Fully materialized claim populations and their independent references. */
export interface IEvidenceGraphInput {
  claims: IEvidenceGraphClaim[];
}
