import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { EvidenceGraphNode } from "../typings/EvidenceGraphNode";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceGraphBoundary } from "./IEvidenceGraphBoundary";
import type { IEvidenceGraphExportEdge } from "./IEvidenceGraphExportEdge";
import type { IEvidenceGraphExportReview } from "./IEvidenceGraphExportReview";

/**
 * Versioned graph export preserving every independent claim/reference obligation.
 *
 * Nodes are qualified by boundary and role, so shared semantic identities do not
 * merge requirements across references. Accepted acknowledgement edges and review
 * relations remain separate. Report status and diagnostics come from the same
 * check analysis used to construct the graph.
 */
export interface IEvidenceGraphReport {
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
  status: EvidenceCheckStatus;

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
  exitCode: EvidenceCommandExitCode;

  /**
   * Independent obligations with their selection, policy, and coverage ledgers.
   *
   * Repeated references retain distinct entries even when they select identical units.
   */
  boundaries: IEvidenceGraphBoundary[];

  /**
   * Semantic-unit and standalone-carrier nodes ordered by export identity.
   *
   * IDs include the obligation boundary so one unit can appear in several contexts.
   */
  nodes: EvidenceGraphNode[];

  /**
   * Accepted acknowledgement relationships ordered by edge identity.
   *
   * Each edge identifies its carrier-side nodes, exact target, and selected coverage.
   */
  edges: IEvidenceGraphExportEdge[];

  /**
   * Review relationships retained separately from coverage edges.
   *
   * Resolution status can expose unresolved or ambiguous reviews without treating
   * them as accepted acknowledgements.
   */
  reviews: IEvidenceGraphExportReview[];

  /**
   * Findings from the full check analysis in deterministic report order.
   *
   * These explain completeness, policy, and coverage failures visible in the graph.
   */
  diagnostics: IEvidenceDiagnostic[];
}
