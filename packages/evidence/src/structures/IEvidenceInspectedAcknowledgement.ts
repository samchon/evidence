import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceHost } from "./IEvidenceHost";

/** Accepted incoming acknowledgement within its independent obligation. */
export interface IEvidenceInspectedAcknowledgement {
  claim: number;
  reference: number;
  declaration: IEvidenceDeclaration;
  host: IEvidenceHost;
  hostUnitIds: string[];
  targetUnitId: string;
  unitIds: string[];
  fingerprint: string;
}
