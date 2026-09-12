import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";

/** Buffered command output before it is written to the process streams. */
export interface IEvidenceCommandResult {
  exitCode: EvidenceCommandExitCode;
  stdout: string;
  stderr: string;
}
