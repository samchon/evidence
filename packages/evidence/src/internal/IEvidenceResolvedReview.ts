import type { IEvidenceReview } from "../structures/IEvidenceReview";

/** One resolved review and the semantic claim hosts represented by its position. */
export interface IEvidenceResolvedReview {
  review: IEvidenceReview;
  hostUnitIds: string[];
  targetUnitId: string;
}
