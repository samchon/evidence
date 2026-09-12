import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { IEvidenceCheckClaim } from "./IEvidenceCheckClaim";
import type { IEvidenceCheckCounts } from "./IEvidenceCheckCounts";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";

/** Versioned result emitted by `evidence check`. */
export interface IEvidenceCheckReport {
  schemaVersion: 1;
  command: "check";
  configFile: string;
  status: EvidenceCheckStatus;
  success: boolean;
  exitCode: EvidenceCommandExitCode;
  counts: IEvidenceCheckCounts;
  claims: IEvidenceCheckClaim[];
  diagnostics: IEvidenceDiagnostic[];
}
