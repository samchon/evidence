import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidKotlinDeclaration } from "./IEvidKotlinDeclaration";
import type { IEvidKotlinDocumentation } from "./IEvidKotlinDocumentation";

/**
 * Holds the node-free Kotlin extraction retained after a parse session closes.
 *
 * Receiver and alias resolution consumes all selected files after scanning, so
 * this boundary owns source-context facts without retaining parser objects.
 */
export interface IEvidKotlinFileAnalysis {
  /** Retains the selected Kotlin source file that produced this analysis.
   *
   * Receiver resolution uses its physical identity for file-private lookup, and materialization uses its addresses for public citations.
   */
  source: IEvidSourceFile;

  /** Lists extracted declarations, including non-public lookup boundaries.
   *
   * `EvidKotlinReceivers` consumes the records across the snapshot before `EvidKotlinAdapterBase` selects public units.
   */
  declarations: IEvidKotlinDeclaration[];

  /** Lists classified KDoc and unsupported annotation carriers from this file.
   *
   * The adapter preserves tagged unsupported carriers so they can produce host-level diagnostics.
   */
  documentation: IEvidKotlinDocumentation[];

  /** Lists failures encountered while establishing this file's public surface.
   *
   * The adapter forwards them into the inventory together with the `complete` status.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether the scanner understood every surface-affecting form.
   *
   * Incomplete scans are propagated into the inventory so unsupported Kotlin
   * syntax cannot make a coverage check pass with fewer units.
   */
  complete: boolean;
}
