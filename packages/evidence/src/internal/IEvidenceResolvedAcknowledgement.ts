import type { IEvidenceDeclaration } from "../structures/IEvidenceDeclaration";

/**
 * An authored acknowledgement after target resolution.
 *
 * Resolution stores host identities separately from the target because one
 * physical annotation can cover multiple selected descendants.
 */
export interface IEvidenceResolvedAcknowledgement {
  /** Original declaration, retained for diagnostic position and authored wording. */
  declaration: IEvidenceDeclaration;

  /** Claim units represented by the declaration's structural host. */
  hostUnitIds: string[];

  /** Unique reference unit that the declaration resolved to. */
  targetUnitId: string;
}
