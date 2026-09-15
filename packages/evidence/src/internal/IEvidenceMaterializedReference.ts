import type { IEvidenceConfigPlanReference } from "../structures/IEvidenceConfigPlanReference";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/**
 * One enabled reference population after source extraction.
 *
 * References preserve their own inventory because identical semantic IDs may be
 * addressed under different roots, symbols, and severity policies.
 */
export interface IEvidenceMaterializedReference {
  /**
   * Validated configuration and effective severity for this reference
   * occurrence.
   *
   * The graph preserves this plan entry separately when repeated references
   * share an inventory but have distinct authored positions or inherited
   * policy.
   */
  plan: IEvidenceConfigPlanReference;

  /**
   * Extracted reference inventory used for target lookup and ancestor closure.
   *
   * It remains attached to this occurrence because the same unit identity can
   * have a different public address under another configured population.
   */
  inventory: IEvidenceInventory;

  /**
   * Identities selected as referenceable units by this population.
   *
   * Their order follows the configured selection and defines the denominator
   * before structural ancestors are added for context.
   */
  unitIds: string[];
}
