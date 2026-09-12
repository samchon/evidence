import type { EvidenceGraphFormat } from "../typings/EvidenceGraphFormat";

/** Parsed options for exporting the configured Evidence graph. */
export interface IEvidenceGraphCommand {
  operation: "graph";
  cwd: string;
  config: string;
  format: EvidenceGraphFormat;
  output?: string;
}
