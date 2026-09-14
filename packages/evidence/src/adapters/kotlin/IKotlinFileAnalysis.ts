import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IKotlinDeclaration } from "./IKotlinDeclaration";
import type { IKotlinDocumentation } from "./IKotlinDocumentation";

/**
 * Holds the node-free Kotlin extraction retained after a parse session closes.
 *
 * Receiver and alias resolution consumes all selected files after scanning, so
 * this boundary owns source-context facts without retaining parser objects.
 */
export interface IKotlinFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IKotlinDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IKotlinDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether the scanner understood every surface-affecting form.
   *
   * Incomplete scans are propagated into the inventory so unsupported Kotlin
   * syntax cannot make a coverage check pass with fewer units.
   */
  complete: boolean;
}
