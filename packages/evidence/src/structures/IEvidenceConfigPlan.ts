import type { IEvidenceConfigPlanClaim } from "./IEvidenceConfigPlanClaim";

/** Enabled populations after configuration validation and default resolution. */
export interface IEvidenceConfigPlan {
  /** Canonical configuration path that anchors every relative population root. */
  configFile: string;

  claims: IEvidenceConfigPlanClaim[];
}
