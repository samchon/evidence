import type { IEvidenceGraphObligation } from "../structures/IEvidenceGraphObligation";
import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceQueryScope } from "../structures/IEvidenceQueryScope";

/**
 * Population input used to construct a reusable query index.
 *
 * Claim entries provide source and selection context; reference entries
 * additionally join effective graph policy and evaluated coverage. All records
 * belong to the containing query facade's owned analysis snapshot.
 */
export interface IEvidenceQueryPopulation {
  /**
   * Authored configuration boundary and population role.
   *
   * This distinguishes repeated references when query rows share semantic
   * identities.
   */
  scope: IEvidenceQueryScope;

  /**
   * Extracted inventory supplying units, addresses, and structural parents.
   *
   * It can contain unselected units needed for context and exact target
   * inspection.
   */
  inventory: IEvidenceInventory;

  /**
   * Configured semantic selection in its retained order.
   *
   * The query index derives ancestor closure separately rather than extending
   * this denominator.
   */
  unitIds: string[];

  /**
   * Effective reference input when this population represents a requirement.
   *
   * Claim populations omit it; reference queries use it to present policy
   * details.
   */
  reference?: IEvidenceGraphReference;

  /**
   * Evaluated coverage ledger for a reference population.
   *
   * Omission on claim entries means reference coverage cannot be inferred from
   * them.
   */
  obligation?: IEvidenceGraphObligation;
}
