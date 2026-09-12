import type { IEvidenceTargetResolution } from "./IEvidenceTargetResolution";

/** Resolution of one claim acknowledgement within one reference. */
export interface IEvidenceGraphResolution {
  declarationId: string;
  resolution: IEvidenceTargetResolution;
}
