import type { IEvidenceConfigPlanClaim } from "../structures/IEvidenceConfigPlanClaim";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

import type { IEvidenceMaterializedReference } from "./IEvidenceMaterializedReference";

/**
 * One enabled claim with the inventories needed to resolve its acknowledgements.
 *
 * This record belongs to a single analysis pass. It retains configuration order
 * and selected identities so later graph construction never needs to rediscover
 * files or reinterpret a mutable user configuration.
 */
export interface IEvidenceMaterializedClaim {
  /** Validated, enabled claim policy that owns this population's configuration position. */
  plan: IEvidenceConfigPlanClaim;

  /** Extracted claim inventory, including contextual units outside the denominator. */
  inventory: IEvidenceInventory;

  /** Semantic identities selected by the claim, in configured selection order. */
  unitIds: string[];

  /** Hosts that may carry exclusions when exclusion scope differs from selected units. */
  exclusionHostIds?: string[];

  /** Reference inventories evaluated against this claim in authored reference order. */
  references: IEvidenceMaterializedReference[];
}
