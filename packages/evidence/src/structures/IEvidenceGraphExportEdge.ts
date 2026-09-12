import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";

/** One accepted acknowledgement edge scoped to an independent obligation. */
export interface IEvidenceGraphExportEdge {
  id: string;
  boundaryId: string;
  kind: EvidenceAcknowledgementKind;
  declaration: IEvidenceDeclaration;
  sourceNodeIds: string[];
  hostUnitIds: string[];
  targetNodeId: string;
  targetUnitId: string;
  unitIds: string[];
  fingerprint: string;
}
