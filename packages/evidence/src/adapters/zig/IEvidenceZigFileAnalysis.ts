import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceZigDeclaration } from "./IEvidenceZigDeclaration";
import type { IEvidenceZigDocumentation } from "./IEvidenceZigDocumentation";

/**
 * Holds the node-free Zig extraction retained after a parse session closes.
 *
 * Alias reconciliation works from this serializable record after the parser is
 * closed, retaining the physical sites that support each exported address.
 */
export interface IEvidenceZigFileAnalysis {
  /**
   * Retains the selected source snapshot that produced this extraction.
   *
   * Its physical path and public addresses anchor all later diagnostics, sites,
   * and public-address materialization for this file.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists declarations extracted from the file, including non-public
   * boundaries.
   *
   * Alias reconciliation filters public records for publication while retaining
   * source-level ownership information needed to interpret their
   * relationships.
   */
  declarations: IEvidenceZigDeclaration[];

  /**
   * Holds classified documentation and unsupported annotation carriers.
   *
   * The adapter parses these records after public units are known so tags
   * cannot attach to a declaration that never reaches the selected public
   * surface.
   */
  documentation: IEvidenceZigDocumentation[];

  /**
   * Records failures encountered while establishing the public surface.
   *
   * These diagnostics reach the final inventory to prevent unsupported source
   * forms from reducing the coverage population without a reported failure.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether scanning classified every surface-affecting Zig form.
   *
   * The inventory treats false as a failed boundary, preserving uncertainty
   * rather than allowing an unclassified alias to reduce the public
   * population.
   */
  complete: boolean;
}
