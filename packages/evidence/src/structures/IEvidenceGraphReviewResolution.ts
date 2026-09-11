import type { IEvidenceTargetResolution } from "./IEvidenceTargetResolution";

/** Target resolution prepared for one review statement. */
export interface IEvidenceGraphReviewResolution {
  reviewId: string;
  resolution: IEvidenceTargetResolution;
}
