import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IZigDeclaration } from "./IZigDeclaration";
import type { IZigDocumentation } from "./IZigDocumentation";

/**
 * Holds the node-free Zig extraction retained after a parse session closes.
 *
 * Alias reconciliation works from this serializable record after the parser is
 * closed, retaining the physical sites that support each exported address.
 */
export interface IZigFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IZigDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IZigDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether scanning classified every surface-affecting Zig form.
   *
   * The inventory treats false as a failed boundary, preserving uncertainty
   * rather than allowing an unclassified alias to reduce the public population.
   */
  complete: boolean;
}
