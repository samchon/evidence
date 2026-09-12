import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceInspection } from "./IEvidenceInspection";

/** Versioned result emitted by `evidence inspect`. */
export interface IEvidenceInspectReport {
  schemaVersion: 1;
  command: "inspect";
  configFile: string;
  status: EvidenceCheckStatus;
  success: boolean;
  exitCode: EvidenceCommandExitCode;
  target: string;
  inspections: IEvidenceInspection[];
  diagnostics: IEvidenceDiagnostic[];
}
