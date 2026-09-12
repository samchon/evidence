import type { IEvidenceConfigPlanClaim } from "../structures/IEvidenceConfigPlanClaim";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

import type { IEvidenceMaterializedReference } from "./IEvidenceMaterializedReference";

/** Loaded claim and reference inventories before target resolution. */
export interface IEvidenceMaterializedClaim {
  plan: IEvidenceConfigPlanClaim;
  inventory: IEvidenceInventory;
  unitIds: string[];
  exclusionHostIds?: string[];
  references: IEvidenceMaterializedReference[];
}
