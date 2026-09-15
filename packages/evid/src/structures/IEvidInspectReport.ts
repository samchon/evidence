import type { EvidCheckStatus } from "../typings/EvidCheckStatus";
import type { EvidCommandExitCode } from "../typings/EvidCommandExitCode";
import type { IEvidDiagnostic } from "./IEvidDiagnostic";
import type { IEvidInspection } from "./IEvidInspection";

/**
 * Versioned target-resolution report across applicable configured populations.
 *
 * Each inspection retains its own scope because identical target spellings can
 * occur in independent references. Success requires every inspected boundary to
 * resolve and the underlying analysis to pass; unavailable analysis takes
 * precedence over ordinary target-resolution failures.
 */
export interface IEvidInspectReport {
  /**
   * Serialization version of the inspection report.
   *
   * Consumers inspect this before interpreting population-specific detail records.
   */
  schemaVersion: 1;

  /**
   * Discriminator identifying target-inspection output.
   *
   * The report expands one requested target rather than listing all discoverable units.
   */
  command: "inspect";

  /**
   * Configuration path anchoring the analyzed populations.
   *
   * Scope indices and inherited diagnostics refer to this check configuration.
   */
  configFile: string;

  /**
   * Combined completeness of the original check and target resolutions.
   *
   * Any incomplete inspection makes the report incomplete even if other boundaries resolve.
   */
  status: EvidCheckStatus;

  /**
   * Whether all inspected targets resolve and the combined outcome passes.
   *
   * An empty inspection set cannot establish success, nor can successful resolution
   * hide an error from the underlying check.
   */
  success: boolean;

  /**
   * Outcome prioritizing incomplete analysis over unresolved targets.
   *
   * Incomplete analysis returns two, unresolved complete inspection returns one,
   * and fully resolved inspection inherits the check's outcome.
   */
  exitCode: EvidCommandExitCode;

  /**
   * Exact authored target supplied to the query.
   *
   * Population entries retain their normalized address candidates separately.
   */
  target: string;

  /**
   * Resolution and graph context for each applicable population boundary.
   *
   * Entries are ordered by scope identity so asynchronous resolution stays deterministic.
   */
  inspections: IEvidInspection[];

  /**
   * Deduplicated findings from the check and the individual target inspections.
   *
   * These explain both global analysis failures and target-specific resolution problems.
   */
  diagnostics: IEvidDiagnostic[];
}
