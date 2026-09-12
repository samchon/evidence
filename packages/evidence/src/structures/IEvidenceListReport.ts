import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceListItem } from "./IEvidenceListItem";

/** Versioned result emitted by `evidence list`. */
export interface IEvidenceListReport {
  schemaVersion: 1;
  command: "list";
  configFile: string;
  status: EvidenceCheckStatus;
  success: boolean;
  exitCode: EvidenceCommandExitCode;
  language?: EvidenceArtifactType;
  kind?: EvidenceSymbol;
  total: number;
  items: IEvidenceListItem[];
  diagnostics: IEvidenceDiagnostic[];
}
