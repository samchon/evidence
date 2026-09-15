import type { IEvidDeclaration } from "../structures/IEvidDeclaration";

/**
 * An authored acknowledgement after target resolution.
 *
 * Resolution stores host identities separately from the target because one
 * physical annotation can cover multiple selected descendants.
 */
export interface IEvidResolvedAcknowledgement {
  /**
   * Original acknowledgement declaration retained after target resolution.
   *
   * Diagnostics and reports use its authored wording and source position rather
   * than reconstructing either from the resolved unit IDs.
   */
  declaration: IEvidDeclaration;

  /**
   * Claim units represented by the declaration's structural host.
   *
   * One physical annotation can acknowledge each selected descendant in this
   * collection while retaining its single authored declaration record.
   */
  hostUnitIds: string[];

  /**
   * Unique reference unit named by the acknowledgement target.
   *
   * Resolution assigns this ID only after rejecting missing or ambiguous target
   * spellings, allowing graph evaluation to link the two populations directly.
   */
  targetUnitId: string;
}
