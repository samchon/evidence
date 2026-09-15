import type { EvidActiveSeverity } from "../typings/EvidActiveSeverity";
import type { EvidArtifactType } from "../typings/EvidArtifactType";

/**
 * Compact coverage result for one claim/reference boundary.
 *
 * This projects a graph obligation into counts for command output. It retains
 * activation and completeness because a zero-sized result is not proof that
 * extraction succeeded, and severity determines whether findings fail the check.
 */
export interface IEvidCheckObligation {
  /**
   * Authored index of the claim that owes this evidence.
   *
   * Combined with the reference index, it identifies the diagnostic boundary.
   */
  claim: number;

  /**
   * Authored reference index within the claim.
   *
   * Identical populations at different indices impose separate obligations.
   */
  reference: number;

  /**
   * Artifact family on the required reference side.
   *
   * This can differ from the claim family, such as code cited from Markdown.
   */
  type: EvidArtifactType;

  /**
   * Effective severity after configuration inheritance.
   *
   * Off references are removed during planning; remaining findings are warnings
   * or errors according to this policy.
   */
  severity: EvidActiveSeverity;

  /**
   * Whether this obligation participates in aggregate coverage.
   *
   * Inactive entries retain their result shape but are excluded from totals.
   */
  active: boolean;

  /**
   * Whether analysis could establish the obligation's full population.
   *
   * An incomplete active obligation causes exit code two regardless of its counts.
   */
  complete: boolean;

  /**
   * Number of selected semantic reference units.
   *
   * Aliases do not enlarge this denominator; another reference counts its own
   * selection independently.
   */
  units: number;

  /**
   * Number of selected units acknowledged under this reference's policy.
   *
   * Repeated citations to one identity do not add another covered unit.
   */
  coveredUnits: number;

  /**
   * Number of selected units still lacking required evidence.
   *
   * Read this together with completeness before treating the result as exhaustive.
   */
  missingUnits: number;
}
