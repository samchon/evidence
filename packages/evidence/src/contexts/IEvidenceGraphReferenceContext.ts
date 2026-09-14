import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceGraphResolution } from "../structures/IEvidenceGraphResolution";
import type { IEvidenceGraphReviewResolution } from "../structures/IEvidenceGraphReviewResolution";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";
import type { IEvidenceGraphClaimContext } from "./IEvidenceGraphClaimContext";

/** One independent obligation after its claim and reference targets are resolved. */
export interface IEvidenceGraphReferenceContext {
  /** Claim context shared by this claim's independent reference obligations. */
  readonly claim: IEvidenceGraphClaimContext;

  /** Reference selection and coverage policy for this obligation. */
  readonly reference: IEvidenceGraphReference;

  /** Reconciled reference inventory used for coverage and fingerprints. */
  readonly inventory: IEvidenceInventory;

  /** Reference units and structural scopes selected for this obligation. */
  readonly population: IEvidencePopulation;

  /** Position of this reference within its claim. */
  readonly index: number;

  /** Acknowledgement targets resolved against this reference population. */
  readonly resolutions: IEvidenceGraphResolution[];

  /** Review targets resolved separately from coverage acknowledgements. */
  readonly reviewResolutions: IEvidenceGraphReviewResolution[];
}
