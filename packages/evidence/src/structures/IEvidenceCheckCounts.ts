/** Aggregate counts shared by text and JSON check output. */
export interface IEvidenceCheckCounts {
  claims: number;
  activeClaims: number;
  obligations: number;
  activeObligations: number;
  incompleteObligations: number;
  units: number;
  coveredUnits: number;
  missingUnits: number;
  errors: number;
  warnings: number;
}
