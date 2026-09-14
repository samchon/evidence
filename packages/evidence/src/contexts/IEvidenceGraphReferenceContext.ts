import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceGraphResolution } from "../structures/IEvidenceGraphResolution";
import type { IEvidenceGraphReviewResolution } from "../structures/IEvidenceGraphReviewResolution";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";
import type { IEvidenceGraphClaimContext } from "./IEvidenceGraphClaimContext";

/**
 * Collects resolved state for one reference obligation beneath a graph claim.
 *
 * A claim can contain several references to overlapping semantic units, but each
 * reference owns its policy, selected population, coverage ledger, and review
 * resolution. Evaluators use this context to preserve that independence while
 * sharing only the claim-side host and declaration information.
 */
export interface IEvidenceGraphReferenceContext {
  /**
   * Claim-side context shared by this claim's independent reference obligations.
   *
   * It supplies the selected hosts and declaration participation table; it does
   * not merge this reference's policy or coverage outcome with a sibling's.
   */
  readonly claim: IEvidenceGraphClaimContext;

  /**
   * Materialized reference selection and graph policy being evaluated.
   *
   * Its target IDs define this obligation's reference population. Cardinality,
   * exclusions, checklist, and review requirements all apply at this boundary.
   */
  readonly reference: IEvidenceGraphReference;

  /**
   * Reconciled reference inventory used for target coverage and review fingerprints.
   *
   * An incomplete inventory prevents the evaluator from treating an apparent
   * match or absence as conclusive because extraction may have omitted a unit.
   */
  readonly inventory: IEvidenceInventory;

  /**
   * Reference units and structural owners selected for this obligation.
   *
   * The selected denominator and aggregate target scopes differ: an ancestor can
   * be addressable for resolution without becoming a separately required unit.
   */
  readonly population: IEvidencePopulation;

  /**
   * Zero-based position of this reference within its owning claim.
   *
   * Participation indexes use this value to determine which acknowledgements and
   * reviews apply without confusing duplicate references in the same claim.
   */
  readonly index: number;

  /**
   * Acknowledgement targets resolved against this reference population.
   *
   * These results feed coverage, exclusions, cardinality, and checklist handling.
   * They deliberately exclude review targets, which have a separate lifecycle.
   */
  readonly resolutions: IEvidenceGraphResolution[];

  /**
   * Review targets resolved independently from coverage acknowledgements.
   *
   * A review validates relationship and fingerprint freshness; it never creates
   * coverage merely because it points at the same semantic target.
   */
  readonly reviewResolutions: IEvidenceGraphReviewResolution[];
}
