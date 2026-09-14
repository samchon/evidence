import type { IEvidenceMaterializedClaim } from "../internal/IEvidenceMaterializedClaim";
import type { IEvidenceConfigPlan } from "../structures/IEvidenceConfigPlan";

/** Configuration and materialized inputs owned by one checker execution. */
export interface IEvidenceCheckContext {
  /** Configuration snapshot used throughout this execution. */
  readonly plan: IEvidenceConfigPlan;

  /** Adapter results materialized from this same configuration snapshot. */
  readonly claims: IEvidenceMaterializedClaim[];
}
