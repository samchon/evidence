import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceMatlabDeclaration } from "./IEvidenceMatlabDeclaration";
import type { IEvidenceMatlabDocumentation } from "./IEvidenceMatlabDocumentation";

/**
 * Holds the node-free MATLAB extraction retained after a parse session closes.
 *
 * Class-folder ownership is resolved from selected files after scanning, so the
 * intermediate record retains physical declarations and diagnostics together.
 */
export interface IEvidenceMatlabFileAnalysis {
  /**
   * Retains the selected source snapshot represented by this extraction.
   *
   * Its physical path participates in class-folder ownership and diagnostic
   * locations.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists extracted declarations, including non-public ownership boundaries.
   *
   * The resolver needs hidden records to determine whether descendants can be
   * published.
   */
  declarations: IEvidenceMatlabDeclaration[];

  /**
   * Lists classified help text and unsupported annotation carriers.
   *
   * EvidenceMatlabAdapter creates hosts only after ownership reconciliation
   * establishes eligible units.
   */
  documentation: IEvidenceMatlabDocumentation[];

  /**
   * Collects failures found while establishing the static public surface.
   *
   * These diagnostics propagate to the inventory rather than removing ambiguous
   * declarations.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether the scanner classified every relevant MATLAB form.
   *
   * A false value remains a failed analysis through ownership reconciliation,
   * preventing unsupported class layout from shrinking the selected surface.
   */
  complete: boolean;
}
