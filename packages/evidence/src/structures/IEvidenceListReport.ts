import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidenceCheckStatus } from "../typings/EvidenceCheckStatus";
import type { EvidenceCommandExitCode } from "../typings/EvidenceCommandExitCode";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceListItem } from "./IEvidenceListItem";

/**
 * Versioned target-discovery report over an existing evidence analysis.
 *
 * Rows include selected identities and their addressable ancestors, optionally
 * filtered by artifact family and symbol kind. Filters affect displayed rows
 * only: completeness, success, and diagnostics still describe the underlying
 * full check.
 */
export interface IEvidenceListReport {
  /**
   * Serialization version of the list result.
   *
   * Consumers inspect this before interpreting row and scope fields.
   */
  schemaVersion: 1;

  /**
   * Discriminator identifying target-discovery output.
   *
   * It separates this row collection from check, inspection, and graph reports.
   */
  command: "list";

  /**
   * Configuration anchor of the analyzed populations.
   *
   * Row scope indices refer to entries authored in this configuration.
   */
  configFile: string;

  /**
   * Completeness inherited from the full check analysis.
   *
   * Filtering away rows cannot turn incomplete extraction into a complete
   * result.
   */
  status: EvidenceCheckStatus;

  /**
   * Success inherited from the analyzed check.
   *
   * Discovering usable targets does not suppress coverage errors elsewhere in
   * that check.
   */
  success: boolean;

  /**
   * Process outcome inherited from the analyzed check.
   *
   * The list operation preserves incomplete and error states despite returning
   * rows.
   */
  exitCode: EvidenceCommandExitCode;

  /**
   * Requested artifact-family filter, when supplied.
   *
   * Omission permits rows from every configured artifact family.
   */
  language?: EvidenceArtifactType;

  /**
   * Requested symbol-kind filter, when supplied.
   *
   * Omission retains all kinds within the selected language filter.
   */
  kind?: EvidenceSymbol;

  /**
   * Number of rows remaining after query filters.
   *
   * This counts population-qualified rows, including structural ancestors,
   * rather than reporting the check's coverage denominator.
   */
  total: number;

  /**
   * Discoverable units ordered by their population-qualified row IDs.
   *
   * Each row retains its aliases and selection state for authoring exact
   * citations.
   */
  items: IEvidenceListItem[];

  /**
   * Diagnostics inherited from the underlying full analysis.
   *
   * They remain visible even if language or kind filters omit the affected
   * rows.
   */
  diagnostics: IEvidenceDiagnostic[];
}
