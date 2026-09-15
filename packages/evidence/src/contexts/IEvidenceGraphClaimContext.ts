import type { IEvidenceGraphClaim } from "../structures/IEvidenceGraphClaim";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";

/**
 * Captures the claim-side state required to evaluate its reference obligations.
 *
 * The graph creates this context after materialized claim targets are
 * reconciled. Every reference beneath the claim reuses its host population, but
 * resolves and evaluates reference-side units independently through its own
 * context.
 */
export interface IEvidenceGraphClaimContext {
  /**
   * Materialized claim configuration, declarations, hosts, and references.
   *
   * This preserves the configuration boundary that owns reference indexes, even
   * when another claim selects the same source host or semantic identity.
   */
  readonly claim: IEvidenceGraphClaim;

  /**
   * Reconciled claim inventory used for diagnostics and host lookup.
   *
   * Semantic validation failures are retained here so graph evaluation can
   * report an incomplete claim instead of evaluating only the records that
   * survived.
   */
  readonly inventory: IEvidenceInventory;

  /**
   * Selected claim units, structural scopes, and eligible documentation hosts.
   *
   * Structural ancestors make aggregate addresses resolvable, whereas the
   * selected set determines required claim membership and the available
   * attachment hosts.
   */
  readonly population: IEvidencePopulation;

  /**
   * Zero-based position of this claim in the captured graph input.
   *
   * Diagnostics and exported boundaries preserve this coordinate so duplicate
   * claims remain distinguishable rather than collapsing by target identity.
   */
  readonly index: number;
}
