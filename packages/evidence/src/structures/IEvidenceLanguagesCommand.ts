import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/** Parsed options for reporting certified language support. */
export interface IEvidenceLanguagesCommand {
  operation: "languages";
  cwd: string;
  format: EvidenceReportFormat;
  output?: string;
}
