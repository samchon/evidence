import type { IEvidCheckReport } from "./IEvidCheckReport";

/**
 * Published watch cycle containing a fresh, stable Evidence Graph check report.
 *
 * The envelope identifies its place in the watch stream while mirroring the
 * report's completeness, success, and exit status. A stable incomplete analysis
 * is still publishable; operational exceptions use the separate failure
 * envelope.
 */
export interface IEvidWatchCheckCycle {
  /**
   * Version of the watch envelope's serialization contract.
   *
   * Readers can validate it before interpreting the nested report and cycle
   * fields.
   */
  schemaVersion: 1;

  /**
   * Operation reevaluated by the watcher.
   *
   * Watch publishes check outcomes rather than list, inspect, or graph queries.
   */
  command: "check";

  /**
   * Discriminator marking this result as part of a watch stream.
   *
   * Consumers use cycle numbers to distinguish repeated evaluations of one
   * command.
   */
  watch: true;

  /**
   * One-based sequence number of the published result.
   *
   * Stable failures and successful analyses share the same publication
   * sequence; discarded unstable attempts do not consume another number.
   */
  cycle: number;

  /**
   * Completeness state copied from the fresh check report.
   *
   * Complete describes analysis availability, not whether coverage errors were
   * found.
   */
  status: "complete" | "incomplete";

  /**
   * Whether the complete report has no error diagnostics.
   *
   * Warning-only findings can pass, while incomplete analysis cannot.
   */
  success: boolean;

  /**
   * Check outcome copied into the watch envelope.
   *
   * Zero passes, one reports completed errors, and two reports incomplete
   * analysis; publication itself does not end the watcher.
   */
  exitCode: 0 | 1 | 2;

  /**
   * Full check result underlying the envelope's outcome fields.
   *
   * It retains independent claims, counts, and actionable diagnostics for this
   * cycle.
   */
  report: IEvidCheckReport;
}
