import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/** Parsed options for resolving and inspecting one target. */
export interface IEvidenceInspectCommand {
  operation: "inspect";
  target: string;
  cwd: string;
  config: string;
  format: EvidenceReportFormat;
  output?: string;
}
