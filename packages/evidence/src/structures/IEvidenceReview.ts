import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceTargetStatement } from "./IEvidenceTargetStatement";

/** A verification statement; it cannot structurally substitute for an acknowledgement. */
export interface IEvidenceReview extends IEvidenceTargetStatement {
  id: string;
  reviews: EvidenceAcknowledgementKind;
  fingerprint?: string;
  description: string;
}
