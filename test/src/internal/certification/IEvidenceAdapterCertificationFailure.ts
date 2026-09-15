import type { IEvidenceAdapterCertificationSource } from "./IEvidenceAdapterCertificationSource";

/** Source set and required diagnostics for one incomplete analysis boundary. */
export interface IEvidenceAdapterCertificationFailure {
  sources: IEvidenceAdapterCertificationSource[];
  diagnosticCodes: string[];
}
