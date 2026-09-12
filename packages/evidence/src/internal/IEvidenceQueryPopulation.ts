import type { IEvidenceGraphObligation } from "../structures/IEvidenceGraphObligation";
import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceQueryScope } from "../structures/IEvidenceQueryScope";

/** Materialized population and its optional evaluated obligation. */
export interface IEvidenceQueryPopulation {
  scope: IEvidenceQueryScope;
  inventory: IEvidenceInventory;
  unitIds: string[];
  reference?: IEvidenceGraphReference;
  obligation?: IEvidenceGraphObligation;
}
