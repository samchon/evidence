import type { IAdapterCertificationSource } from "./IAdapterCertificationSource";

/** Source set and required diagnostics for one incomplete analysis boundary. */
export interface IAdapterCertificationFailure {
  sources: IAdapterCertificationSource[];
  diagnosticCodes: string[];
}
