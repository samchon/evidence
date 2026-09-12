import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";

/** One accepted acknowledgement and the selected units its scope covers. */
export interface IEvidenceGraphEdge {
  declarationId: string;
  /** Documentation position that carries the acknowledgement. */
  hostId: string;
  /** Selected semantic claim hosts represented by that position. */
  hostUnitIds: string[];
  kind: EvidenceAcknowledgementKind;
  targetUnitId: string;
  unitIds: string[];
  /** Current seven-character fingerprint of the exact cited scope. */
  fingerprint: string;
}
