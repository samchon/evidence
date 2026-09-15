import type { IEvidConfigPlanClaim } from "../structures/IEvidConfigPlanClaim";
import type { IEvidInventory } from "../structures/IEvidInventory";

import type { IEvidMaterializedReference } from "./IEvidMaterializedReference";

/**
 * One enabled claim with the inventories needed to resolve its acknowledgements.
 *
 * This record belongs to a single analysis pass. It retains configuration order
 * and selected identities so later graph construction never needs to rediscover
 * files or reinterpret a mutable user configuration.
 */
export interface IEvidMaterializedClaim {
  /**
   * Validated, enabled claim policy that owns this population's configuration position.
   *
   * Later graph construction reads its effective policy without revisiting the
   * mutable configuration document that produced this analysis pass.
   */
  plan: IEvidConfigPlanClaim;

  /**
   * Extracted claim inventory, including contextual units outside the denominator.
   *
   * Structural parents remain available for host and withdrawal decisions even
   * when only the selected units contribute claim obligations.
   */
  inventory: IEvidInventory;

  /**
   * Semantic identities selected by the claim, in configured selection order.
   *
   * This collection is the claim denominator and remains narrower than the
   * inventory's contextual population.
   */
  unitIds: string[];

  /**
   * Hosts that may carry exclusions when exclusion scope differs from selected units.
   *
   * Omission means the selected unit IDs also define every eligible exclusion
   * host, so graph processing needs no separate structural population.
   */
  exclusionHostIds?: string[];

  /**
   * Reference inventories evaluated against this claim in authored reference order.
   *
   * The order preserves independent configuration occurrences for diagnostics
   * and query rows even when they resolve to overlapping identities.
   */
  references: IEvidMaterializedReference[];
}
