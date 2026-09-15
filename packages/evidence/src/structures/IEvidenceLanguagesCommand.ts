import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/**
 * Parsed request for certified programming and database capability metadata.
 *
 * This command does not load configuration or analyze project files. Its
 * working directory exists only to resolve an optional report destination.
 */
export interface IEvidenceLanguagesCommand {
  /**
   * Discriminator selecting the certified capability catalog.
   *
   * Grammar-only candidates are excluded from this supported-language report.
   */
  operation: "languages";

  /**
   * Working directory used to resolve the output destination.
   *
   * It does not select project populations because the catalog is
   * configuration-independent.
   */
  cwd: string;

  /**
   * Text or JSON presentation of adapter capabilities.
   *
   * Parsing defaults to text and rejects formats outside the report vocabulary.
   */
  format: EvidenceReportFormat;

  /**
   * Optional destination file for capability output.
   *
   * Omission sends the formatted catalog to standard output without source
   * analysis.
   */
  output?: string;
}
