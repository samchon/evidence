import type { EvidCheckStatus } from "../typings/EvidCheckStatus";
import type { EvidCommandExitCode } from "../typings/EvidCommandExitCode";
import type { IEvidCheckClaim } from "./IEvidCheckClaim";
import type { IEvidCheckCounts } from "./IEvidCheckCounts";
import type { IEvidDiagnostic } from "./IEvidDiagnostic";

/**
 * Versioned coverage report shared by the checker and its output renderers.
 *
 * Completion describes whether the selected populations could be analyzed;
 * success additionally requires no error diagnostics. A complete report can
 * therefore fail coverage, while warning-only findings can still pass. Claims
 * retain configuration indices so consumers can attribute each independent
 * obligation without relying on an optional display name.
 */
export interface IEvidCheckReport {
  /**
   * Serialization contract understood by report consumers.
   *
   * Readers can check this discriminator before interpreting counts or claims.
   */
  schemaVersion: 1;

  /**
   * Operation that produced this report.
   *
   * This distinguishes check output from query reports and operational
   * failures.
   */
  command: "check";

  /**
   * Configuration file resolved for this evaluation.
   *
   * The path provides context for claim indices and is retained in text output.
   */
  configFile: string;

  /**
   * Whether all active claims and obligations were analyzed completely.
   *
   * A complete analysis can still report missing evidence and return failure.
   */
  status: EvidCheckStatus;

  /**
   * Whether the complete analysis contains no error diagnostics.
   *
   * Warnings alone do not fail the check; incomplete analysis always does.
   */
  success: boolean;

  /**
   * Process outcome corresponding to completeness and error severity.
   *
   * Zero passes, one means a complete check found errors, and two means the
   * analysis was incomplete.
   */
  exitCode: EvidCommandExitCode;

  /**
   * Aggregate participation, coverage, and diagnostic counts.
   *
   * Coverage totals sum active obligations, so a unit required by two
   * references contributes once to each obligation rather than once to the
   * whole report.
   */
  counts: IEvidCheckCounts;

  /**
   * Evaluated claims with their independent reference results.
   *
   * Entries carry authored indices even when configuration planning removed
   * disabled entries before evaluation.
   */
  claims: IEvidCheckClaim[];

  /**
   * Findings sorted by configuration, source, and diagnostic coordinates.
   *
   * Both output formats consume this order so asynchronous extraction does not
   * reorder otherwise equivalent reports.
   */
  diagnostics: IEvidDiagnostic[];
}
