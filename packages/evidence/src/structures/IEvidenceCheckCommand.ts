import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/** Parsed options for one complete graph check. */
export interface IEvidenceCheckCommand {
  operation: "check";
  cwd: string;
  config: string;
  format: EvidenceReportFormat;
  output?: string;
}
