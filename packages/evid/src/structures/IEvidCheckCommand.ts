import type { EvidReportFormat } from "../typings/EvidReportFormat";

/**
 * Parsed request to evaluate configured Evid obligations.
 *
 * The command layer resolves cwd against its invocation base, then resolves the
 * configuration and optional output path within that directory. Watch requests
 * require streaming execution; the buffered command API rejects them.
 */
export interface IEvidCheckCommand {
  /**
   * Discriminator selecting coverage-check execution.
   *
   * This is also the default operation when the argument list omits a command name.
   */
  operation: "check";

  /**
   * Working directory relative to the invocation base, or an absolute path.
   *
   * Parsing defaults it to dot; execution resolves it without changing process cwd.
   */
  cwd: string;

  /**
   * Configuration path resolved from the command's working directory.
   *
   * Parsing supplies evid.config.ts when no configuration option is present.
   */
  config: string;

  /**
   * Text or JSON representation requested for reports.
   *
   * Parsing defaults to text; watch uses the chosen representation for each cycle.
   */
  format: EvidReportFormat;

  /**
   * Optional output-file path resolved from the command's working directory.
   *
   * Omission sends report content to process output; watch appends successive cycles.
   */
  output?: string;

  /**
   * Requests continued observation after the initial check.
   *
   * Omission performs one check. When true, streaming execution publishes stable
   * filesystem-triggered cycles and timed parser-acquisition recovery attempts.
   */
  watch?: true;
}
