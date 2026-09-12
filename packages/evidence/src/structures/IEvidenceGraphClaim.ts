import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceGraphReference } from "./IEvidenceGraphReference";
import type { IEvidenceInventory } from "./IEvidenceInventory";

/** One claim population prepared for graph evaluation. */
export interface IEvidenceGraphClaim {
  /** Original zero-based configuration position; defaults to the array position. */
  index?: number;
  name?: string;
  severity: EvidenceSeverity;
  inventory: IEvidenceInventory;
  /** Semantic identities selected as claim hosts. */
  unitIds: string[];
  /** Eligible exclusion hosts; omission permits every attached public host. */
  exclusionHostIds?: string[];
  references: IEvidenceGraphReference[];
}
