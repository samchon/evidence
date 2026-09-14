import type { IEvidenceMaterializedClaim } from "../internal/IEvidenceMaterializedClaim";
import type { IEvidenceConfigPlan } from "../structures/IEvidenceConfigPlan";

/**
 * Captures configuration and adapter output for one checker execution.
 *
 * The checker builds this context after configuration resolution and source
 * materialization. Downstream graph preparation uses both fields together so
 * plan coordinates, selected roots, and parsed declarations refer to one stable
 * run rather than to a mix of later configuration or filesystem state.
 */
export interface IEvidenceCheckContext {
  /**
   * Resolved configuration plan used throughout this checker execution.
   *
   * It retains effective activation and original configuration coordinates, which
   * graph diagnostics use to identify the declaration that created an obligation.
   */
  readonly plan: IEvidenceConfigPlan;

  /**
   * Claim adapter results materialized from the same configuration snapshot.
   *
   * Each entry retains claim and reference inventories before graph evaluation so
   * incomplete scans remain visible instead of being removed during preparation.
   */
  readonly claims: IEvidenceMaterializedClaim[];
}
