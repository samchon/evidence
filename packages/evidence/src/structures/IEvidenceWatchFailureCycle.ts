/**
 * Published watch cycle for a stable configuration or operational exception.
 *
 * The watcher cannot provide a normal check report for this attempt, but
 * retains dependencies so a later repair can trigger another cycle. Parser
 * acquisition failures also retry on a timer because recovery may require no
 * source edit.
 */
export interface IEvidenceWatchFailureCycle {
  /**
   * Version of the failure envelope's serialization contract.
   *
   * It is inspected before interpreting the watch sequence and repair fields.
   */
  schemaVersion: 1;

  /**
   * Check operation that the watcher attempted.
   *
   * The failure belongs to reevaluation of the configured Evidence Graph check.
   */
  command: "check";

  /**
   * Discriminator marking an ongoing watch-stream result.
   *
   * A failed cycle does not imply that the watcher has stopped observing
   * repairs.
   */
  watch: true;

  /**
   * One-based publication sequence shared with normal check cycles.
   *
   * The next recovered result continues this sequence instead of restarting it.
   */
  cycle: number;

  /**
   * Operational-failure discriminator for an unavailable check report.
   *
   * An analyzed but incomplete population instead uses a check-cycle envelope.
   */
  status: "failed";

  /**
   * Failed outcome for consumers inspecting the common success field.
   *
   * An exception cannot certify complete coverage, even if an earlier cycle
   * passed.
   */
  success: false;

  /**
   * Outcome code for unavailable analysis in this cycle.
   *
   * This is published as data and does not itself terminate ongoing
   * observation.
   */
  exitCode: 2;

  /**
   * Resolved configuration path associated with the failed attempt.
   *
   * The path remains available even when configuration evaluation itself
   * failed.
   */
  configFile: string;

  /**
   * Explanation derived from the configuration or operational exception.
   *
   * It identifies the current failure rather than repeating the previous
   * cycle's report.
   */
  message: string;

  /**
   * Corrective guidance and the applicable retry behavior.
   *
   * Parser acquisition can retry automatically; other failures wait for a
   * watched filesystem change that permits another complete attempt.
   */
  repair: string;
}
