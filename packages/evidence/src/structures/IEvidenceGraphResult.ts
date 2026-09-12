import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceGraphClaimResult } from "./IEvidenceGraphClaimResult";

/** Serializable graph result for every configured claim. */
export interface IEvidenceGraphResult {
  /** True only when evaluation is complete and produces no findings. */
  success: boolean;
  claims: IEvidenceGraphClaimResult[];
  diagnostics: IEvidenceDiagnostic[];
}
