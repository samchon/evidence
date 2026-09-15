import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceObjcDeclaration } from "./IEvidenceObjcDeclaration";
import type { IEvidenceObjcDocumentation } from "./IEvidenceObjcDocumentation";

/**
 * Holds the node-free Objective-C extraction retained after a parse session
 * closes.
 *
 * Interface and implementation sites are reconciled only after every selected
 * source is scanned, while this record keeps their physical provenance intact.
 */
export interface IEvidenceObjcFileAnalysis {
  /**
   * Snapshot source and its logical aliases.
   *
   * Its physical path anchors sites while aliases supply published files.
   */
  source: IEvidenceSourceFile;

  /**
   * Physical declaration sites before public identity reconciliation.
   *
   * Later materialization merges compatible interface and implementation
   * records.
   */
  declarations: IEvidenceObjcDeclaration[];

  /**
   * Attached and unsupported documentation carriers.
   *
   * Unsupported tagged carriers remain available for actionable diagnostics.
   */
  documentation: IEvidenceObjcDocumentation[];

  /**
   * Actionable extraction and parser failures.
   *
   * Consumers retain these findings instead of accepting a smaller inventory.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether all surface-affecting Objective-C forms were classified.
   *
   * A false value protects coverage from incomplete header or implementation
   * extraction by propagating the uncertainty into the final inventory.
   */
  complete: boolean;
}
