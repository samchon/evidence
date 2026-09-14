import type { IEvidenceConfigPlanReference } from "../structures/IEvidenceConfigPlanReference";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/**
 * One enabled reference population after source extraction.
 *
 * References preserve their own inventory because identical semantic IDs may be
 * addressed under different roots, symbols, and severity policies.
 */
export interface IEvidenceMaterializedReference {
  /** Validated configuration and effective severity for this reference occurrence. */
  plan: IEvidenceConfigPlanReference;

  /** Extracted reference inventory used for target lookup and ancestor closure. */
  inventory: IEvidenceInventory;

  /** Identities selected as referenceable units by this population. */
  unitIds: string[];
}
