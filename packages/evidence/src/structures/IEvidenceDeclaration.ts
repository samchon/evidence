import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** One positive citation or exclusion, before population-specific target resolution. */
export interface IEvidenceDeclaration {
  id: string;
  hostId: string;
  kind: EvidenceAcknowledgementKind;
  /** Authored target token; resolution preserves the artifact's address rules. */
  target: string;
  reason: string;
  location: IEvidenceSourceLocation;
}
