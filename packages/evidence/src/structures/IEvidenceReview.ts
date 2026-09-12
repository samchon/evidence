import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** A verification statement; it cannot structurally substitute for an acknowledgement. */
export interface IEvidenceReview {
  id: string;
  hostId: string;
  reviews: EvidenceAcknowledgementKind;
  target: string;
  fingerprint?: string;
  description: string;
  location: IEvidenceSourceLocation;
}
