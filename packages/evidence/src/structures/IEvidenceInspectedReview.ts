import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceReview } from "./IEvidenceReview";

/** Incoming review and the identity resolution it verifies. */
export interface IEvidenceInspectedReview {
  claim: number;
  reference: number;
  review: IEvidenceReview;
  host: IEvidenceHost;
  status: EvidenceTargetResolutionStatus;
  unitIds: string[];
}
