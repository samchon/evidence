import type { IEvidenceAddress } from "../structures/IEvidenceAddress";
import type { IEvidenceResolution } from "../structures/IEvidenceResolution";

/** One logical citation origin and its exact population lookup. */
export interface IEvidenceTargetCandidate {
  address: IEvidenceAddress;
  resolution: IEvidenceResolution;
}
