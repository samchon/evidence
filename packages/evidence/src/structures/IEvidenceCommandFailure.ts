/** Versioned operational failure emitted when JSON output was requested. */
export interface IEvidenceCommandFailure {
  schemaVersion: 1;
  command: "check" | "graph" | "inspect" | "list";
  status: "failed";
  success: false;
  exitCode: 2;
  configFile: string;
  message: string;
  repair: string;
}
