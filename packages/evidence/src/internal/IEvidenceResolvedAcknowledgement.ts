import type { IEvidenceDeclaration } from "../structures/IEvidenceDeclaration";

/** One acknowledgement paired with its resolved target and semantic host. */
export interface IEvidenceResolvedAcknowledgement {
  declaration: IEvidenceDeclaration;
  hostUnitIds: string[];
  targetUnitId: string;
}
