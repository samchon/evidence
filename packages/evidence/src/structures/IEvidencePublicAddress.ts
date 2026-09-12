import type { IEvidenceAddress } from "./IEvidenceAddress";

/** One module-qualified spelling of a semantic identity. */
export interface IEvidencePublicAddress extends IEvidenceAddress {
  unitId: string;
}
