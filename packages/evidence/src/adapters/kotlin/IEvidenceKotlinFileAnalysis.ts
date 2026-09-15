import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceKotlinDeclaration } from "./IEvidenceKotlinDeclaration";
import type { IEvidenceKotlinDocumentation } from "./IEvidenceKotlinDocumentation";

/**
 * Holds the node-free Kotlin extraction retained after a parse session closes.
 *
 * Receiver and alias resolution consumes all selected files after scanning, so
 * this boundary owns source-context facts without retaining parser objects.
 */
export interface IEvidenceKotlinFileAnalysis {
  /**
   * Retains the selected Kotlin source file that produced this analysis.
   *
   * Receiver resolution uses its physical identity for file-private lookup, and
   * materialization uses its addresses for public citations.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists extracted declarations, including non-public lookup boundaries.
   *
   * `EvidenceKotlinReceivers` consumes the records across the snapshot before
   * `EvidenceKotlinAdapter` selects public units.
   */
  declarations: IEvidenceKotlinDeclaration[];

  /**
   * Lists classified KDoc and unsupported annotation carriers from this file.
   *
   * The adapter preserves tagged unsupported carriers so they can produce
   * host-level diagnostics.
   */
  documentation: IEvidenceKotlinDocumentation[];

  /**
   * Lists failures encountered while establishing this file's public surface.
   *
   * The adapter forwards them into the inventory together with the `complete`
   * status.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether the scanner understood every surface-affecting form.
   *
   * Incomplete scans are propagated into the inventory so unsupported Kotlin
   * syntax cannot make a coverage check pass with fewer units.
   */
  complete: boolean;
}
