import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";

/** Parsed options for enumerating configured public targets. */
export interface IEvidenceListCommand {
  operation: "list";
  cwd: string;
  config: string;
  format: EvidenceReportFormat;
  output?: string;
  language?: EvidenceArtifactType;
  kind?: EvidenceSymbol;
}
