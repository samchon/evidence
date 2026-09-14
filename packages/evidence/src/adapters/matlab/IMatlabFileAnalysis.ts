import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IMatlabDeclaration } from "./IMatlabDeclaration";
import type { IMatlabDocumentation } from "./IMatlabDocumentation";

/**
 * Holds the node-free MATLAB extraction retained after a parse session closes.
 *
 * Class-folder ownership is resolved from selected files after scanning, so the
 * intermediate record retains physical declarations and diagnostics together.
 */
export interface IMatlabFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IMatlabDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IMatlabDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether the scanner classified every relevant MATLAB form.
   *
   * A false value remains a failed analysis through ownership reconciliation,
   * preventing unsupported class layout from shrinking the selected surface.
   */
  complete: boolean;
}
