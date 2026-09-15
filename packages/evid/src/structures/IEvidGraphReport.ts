import type { EvidCheckStatus } from "../typings/EvidCheckStatus";
import type { EvidCommandExitCode } from "../typings/EvidCommandExitCode";
import type { EvidGraphNode } from "../typings/EvidGraphNode";
import type { IEvidDiagnostic } from "./IEvidDiagnostic";
import type { IEvidGraphBoundary } from "./IEvidGraphBoundary";
import type { IEvidGraphExportEdge } from "./IEvidGraphExportEdge";
import type { IEvidGraphExportReview } from "./IEvidGraphExportReview";

/**
 * Versioned graph export preserving every independent claim/reference obligation.
 *
 * Nodes are qualified by boundary and role, so shared semantic identities do not
 * merge requirements across references. Accepted acknowledgement edges and review
 * relations remain separate. Report status and diagnostics come from the same
 * check analysis used to construct the graph.
 */
export interface IEvidGraphReport {
  /**
   * Serialization version for graph consumers.
   *
   * Readers check this before interpreting boundary-qualified node and edge IDs.
   */
  schemaVersion: 1;

  /**
   * Discriminator identifying a configured graph export.
   *
   * This report includes relationship records beyond the ordinary check summary.
   */
  command: "graph";

  /**
   * Configuration file whose planned populations were evaluated.
   *
   * Boundary indices refer to authored claims and references in this configuration.
   */
  configFile: string;

  /**
   * Completeness inherited from the underlying analysis.
   *
   * Exporting existing nodes cannot certify populations that failed extraction.
   */
  status: EvidCheckStatus;

  /**
   * Check success inherited from completeness and diagnostic severity.
   *
   * A graph can be exported for a failing check so consumers can explain its gaps.
   */
  success: boolean;

  /**
   * Process outcome retained from the analyzed check.
   *
   * Graph serialization does not replace coverage failure with output success.
   */
  exitCode: EvidCommandExitCode;

  /**
   * Independent obligations with their selection, policy, and coverage ledgers.
   *
   * Repeated references retain distinct entries even when they select identical units.
   */
  boundaries: IEvidGraphBoundary[];

  /**
   * Semantic-unit and standalone-carrier nodes ordered by export identity.
   *
   * IDs include the obligation boundary so one unit can appear in several contexts.
   */
  nodes: EvidGraphNode[];

  /**
   * Accepted acknowledgement relationships ordered by edge identity.
   *
   * Each edge identifies its carrier-side nodes, exact target, and selected coverage.
   */
  edges: IEvidGraphExportEdge[];

  /**
   * Review relationships retained separately from coverage edges.
   *
   * Resolution status can expose unresolved or ambiguous reviews without treating
   * them as accepted acknowledgements.
   */
  reviews: IEvidGraphExportReview[];

  /**
   * Findings from the full check analysis in deterministic report order.
   *
   * These explain completeness, policy, and coverage failures visible in the graph.
   */
  diagnostics: IEvidDiagnostic[];
}
