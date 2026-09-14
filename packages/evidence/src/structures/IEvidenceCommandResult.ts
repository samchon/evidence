import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";

/**
 * Buffered output and process status returned by command execution.
 *
 * The CLI boundary writes these strings to their respective streams. Keeping
 * execution separate from process I/O also lets callers inspect command behavior
 * without replacing global streams or spawning another process.
 */
export interface IEvidenceCommandResult {
  /**
   * Outcome to propagate to the invoking process.
   *
   * Zero succeeds, one reports completed check errors, and two reports an
   * operational failure or incomplete analysis.
   */
  exitCode: EvidenceCommandExitCode;

  /**
   * Content prepared for the standard output stream.
   *
   * The string already includes its intended formatting and line endings; it may
   * be empty when output was written to a requested file.
   */
  stdout: string;

  /**
   * Content prepared for the standard error stream.
   *
   * Human-readable operational failures use this channel, while requested JSON
   * failures remain structured command output.
   */
  stderr: string;
}
