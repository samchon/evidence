import type { IEvidenceScalaExport } from "./IEvidenceScalaExport";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceScalaDeclaration } from "./IEvidenceScalaDeclaration";
import type { IEvidenceScalaDocumentation } from "./IEvidenceScalaDocumentation";

/**
 * Holds the node-free Scala extraction retained after a parse session closes.
 *
 * Export reconciliation needs declarations from the selected snapshot at once,
 * while parser state is intentionally released after each source scan.
 */
export interface IEvidenceScalaFileAnalysis {
  /**
   * Retains the selected source snapshot that produced this analysis.
   *
   * Later export and documentation passes use its paths and content after the
   * parser session closes.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists declarations extracted from this source, including non-public
   * boundaries.
   *
   * Visibility is resolved during publication, while retained private records
   * support export and withdrawal decisions.
   */
  declarations: IEvidenceScalaDeclaration[];

  /**
   * Lists classified Scaladoc and tag-bearing unsupported carriers.
   *
   * The adapter materializes them into attached or unsupported hosts after unit
   * publication.
   */
  documentation: IEvidenceScalaDocumentation[];

  /**
   * Lists failures encountered while establishing the Scala public surface.
   *
   * Each diagnostic keeps the source inventory incomplete instead of allowing a
   * smaller population to pass.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Lists explicit forwarding exports awaiting selected-source resolution.
   *
   * Resolution runs after every selected file supplies declarations and lexical
   * lookup paths.
   */
  exports: IEvidenceScalaExport[];

  /**
   * States whether scanning classified every surface-affecting Scala form.
   *
   * The inventory carries a false value forward so incomplete export discovery
   * cannot silently turn a missing obligation into a passing result.
   */
  complete: boolean;
}
