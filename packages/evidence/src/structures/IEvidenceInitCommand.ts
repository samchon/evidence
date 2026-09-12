/** Parsed options for creating an Evidence configuration. */
export interface IEvidenceInitCommand {
  operation: "init";
  cwd: string;
  config: string;
}
