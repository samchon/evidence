import type { IScalaExport } from "./IScalaExport";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IScalaDeclaration } from "./IScalaDeclaration";
import type { IScalaDocumentation } from "./IScalaDocumentation";

/**
 * Holds the node-free Scala extraction retained after a parse session closes.
 *
 * Export reconciliation needs declarations from the selected snapshot at once,
 * while parser state is intentionally released after each source scan.
 */
export interface IScalaFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IScalaDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IScalaDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Explicit exports awaiting selected-source resolution. */
  exports: IScalaExport[];

  /**
   * States whether scanning classified every surface-affecting Scala form.
   *
   * The inventory carries a false value forward so incomplete export discovery
   * cannot silently turn a missing obligation into a passing result.
   */
  complete: boolean;
}
