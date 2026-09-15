import type { IEvidConfigPlanClaim } from "./IEvidConfigPlanClaim";

/**
 * Validated configuration prepared for source materialization.
 *
 * `EvidConfigLoader.plan` resolves inherited severity and default symbol
 * selectors and retains enabled claims and references. The checker consumes
 * this plan to load sources; it has not yet extracted declarations or evaluated
 * coverage. Authored indices survive filtering for accurate diagnostics.
 *
 * A plan may contain no enabled claims even though the original configuration
 * required a nonempty claim array. Disabled or off declarations are validated
 * before that filtering takes place.
 */
export interface IEvidConfigPlan {
  /**
   * Canonical configuration path anchoring relative population roots.
   *
   * Materialization uses its directory instead of the current working directory,
   * keeping programmatic evaluation consistent with configuration loading.
   */
  configFile: string;

  /**
   * Enabled claims with effective policy and selectors.
   *
   * Entries retain their original configuration indices. Filtering inactive claims
   * does not renumber later diagnostics or merge overlapping populations.
   */
  claims: IEvidConfigPlanClaim[];
}
