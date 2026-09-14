import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IObjcDeclaration } from "./IObjcDeclaration";
import type { IObjcDocumentation } from "./IObjcDocumentation";

/**
 * Holds the node-free Objective-C extraction retained after a parse session closes.
 *
 * Interface and implementation sites are reconciled only after every selected
 * source is scanned, while this record keeps their physical provenance intact.
 */
export interface IObjcFileAnalysis {
  /** Snapshot source and its logical aliases. */
  source: IEvidenceSourceFile;

  /** Physical declaration sites before public identity reconciliation. */
  declarations: IObjcDeclaration[];

  /** Attached and unsupported documentation carriers. */
  documentation: IObjcDocumentation[];

  /** Actionable extraction and parser failures. */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether all surface-affecting Objective-C forms were classified.
   *
   * A false value protects coverage from incomplete header or implementation
   * extraction by propagating the uncertainty into the final inventory.
   */
  complete: boolean;
}
