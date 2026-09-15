import type { IEvidAdapterCertificationSource } from "./IEvidAdapterCertificationSource";

/** Source set and required diagnostics for one incomplete analysis boundary. */
export interface IEvidAdapterCertificationFailure {
  sources: IEvidAdapterCertificationSource[];
  diagnosticCodes: string[];
}
