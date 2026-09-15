import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceHost } from "./IEvidenceHost";

/**
 * Accepted incoming acknowledgement relevant to an inspected reference
 * identity.
 *
 * A statement is included when its exact target or covered selected units match
 * the inspected candidate. The record retains both authored source context and
 * evaluated scope, making aggregate citations explainable without flattening
 * independent reference obligations.
 */
export interface IEvidenceInspectedAcknowledgement {
  /**
   * Authored index of the claim supplying the acknowledgement.
   *
   * Together with reference, this identifies the boundary that accepted the
   * edge.
   */
  claim: number;

  /**
   * Authored reference index under the owning claim.
   *
   * Acceptance here does not imply acceptance under another reference's policy.
   */
  reference: number;

  /**
   * Extracted acknowledgement statement with target, reason, and source
   * location.
   *
   * This preserves author intent alongside the evaluated target and coverage
   * IDs.
   */
  declaration: IEvidenceDeclaration;

  /**
   * Documentation carrier owning the accepted statement.
   *
   * Its physical location and origins explain where the target was authored and
   * resolved.
   */
  host: IEvidenceHost;

  /**
   * Selected semantic claim subjects represented by the carrier for this edge.
   *
   * Checklist answers are attributed to these subjects independently.
   */
  hostUnitIds: string[];

  /**
   * Exact semantic target named by the acknowledgement.
   *
   * An aggregate target can be an ancestor of the inspected selected identity.
   */
  targetUnitId: string;

  /**
   * Selected reference identities receiving coverage from the accepted scope.
   *
   * The collection can differ from the exact target when aggregate
   * acknowledgement applies.
   */
  unitIds: string[];

  /**
   * Current fingerprint of the exact cited scope.
   *
   * Review validation concerns that scope rather than only the inspected
   * descendant.
   */
  fingerprint: string;
}
