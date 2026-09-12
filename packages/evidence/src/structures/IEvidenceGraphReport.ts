import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { EvidenceGraphNode } from "../typings/EvidenceGraphNode";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceGraphBoundary } from "./IEvidenceGraphBoundary";
import type { IEvidenceGraphExportEdge } from "./IEvidenceGraphExportEdge";
import type { IEvidenceGraphExportReview } from "./IEvidenceGraphExportReview";

/** Authoritative versioned export of the configured Evidence graph. */
export interface IEvidenceGraphReport {
  schemaVersion: 1;
  command: "graph";
  configFile: string;
  status: EvidenceCheckStatus;
  success: boolean;
  exitCode: EvidenceCommandExitCode;
  boundaries: IEvidenceGraphBoundary[];
  nodes: EvidenceGraphNode[];
  edges: IEvidenceGraphExportEdge[];
  reviews: IEvidenceGraphExportReview[];
  diagnostics: IEvidenceDiagnostic[];
}
