import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceReview } from "./IEvidenceReview";

/** Review relation kept separate from acknowledgement coverage edges. */
export interface IEvidenceGraphExportReview {
  id: string;
  boundaryId: string;
  reviews: EvidenceAcknowledgementKind;
  review: IEvidenceReview;
  status: EvidenceTargetResolutionStatus;
  sourceNodeIds: string[];
  targetNodeIds: string[];
}
