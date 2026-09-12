import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { IEvidenceTargetStatement } from "./IEvidenceTargetStatement";

/** One positive citation or exclusion, before population-specific target resolution. */
export interface IEvidenceDeclaration extends IEvidenceTargetStatement {
  id: string;
  kind: EvidenceAcknowledgementKind;
  reason: string;
}
