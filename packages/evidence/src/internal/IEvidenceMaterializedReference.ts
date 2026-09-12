import type { IEvidenceConfigPlanReference } from "../structures/IEvidenceConfigPlanReference";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/** Loaded reference inventory paired with its resolved configuration. */
export interface IEvidenceMaterializedReference {
  plan: IEvidenceConfigPlanReference;
  inventory: IEvidenceInventory;
  unitIds: string[];
}
