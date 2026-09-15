import type { EvidArtifactType } from "../typings/EvidArtifactType";
import type { IEvidCheckObligation } from "./IEvidCheckObligation";

/**
 * Report entry connecting a configured claim to its evaluated obligations.
 *
 * Labels and artifact types come from the configuration plan; activation,
 * completeness, and coverage come from graph evaluation. Keeping both lets
 * renderers explain a failure without exposing the full extracted inventory.
 */
export interface IEvidCheckClaim {
  /**
   * Zero-based claim index in the authored configuration.
   *
   * Filtering inactive configuration entries does not renumber this identity.
   */
  claim: number;

  /**
   * Optional author-supplied label for display.
   *
   * Omission leaves the numeric claim index as the report's identifying context.
   */
  name?: string;

  /**
   * Artifact family used to extract the claim population.
   *
   * Renderers include it alongside the label to identify the citing side.
   */
  type: EvidArtifactType;

  /**
   * Whether graph evaluation activated this claim.
   *
   * Only active claims contribute to the report's active-claim count.
   */
  active: boolean;

  /**
   * Whether the claim population was materialized completely.
   *
   * Reference completeness is recorded separately on each obligation; this flag
   * alone does not establish that the claim passed all coverage requirements.
   */
  complete: boolean;

  /**
   * Coverage results for this claim's planned references.
   *
   * Repeated references remain separate entries with their own indices and policy.
   */
  obligations: IEvidCheckObligation[];
}
