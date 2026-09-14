import type { IEvidenceGraphClaim } from "../structures/IEvidenceGraphClaim";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";

/** Validated inventory and selected population for one graph claim. */
export interface IEvidenceGraphClaimContext {
  /** Claim configuration and materialized target resolutions. */
  readonly claim: IEvidenceGraphClaim;

  /** Reconciled claim inventory used for diagnostics and host lookup. */
  readonly inventory: IEvidenceInventory;

  /** Selected claim units, ancestors, and eligible hosts. */
  readonly population: IEvidencePopulation;

  /** Position of this claim in the graph input. */
  readonly index: number;
}
