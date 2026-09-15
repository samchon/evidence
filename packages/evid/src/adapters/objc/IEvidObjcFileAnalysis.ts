import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidObjcDeclaration } from "./IEvidObjcDeclaration";
import type { IEvidObjcDocumentation } from "./IEvidObjcDocumentation";

/**
 * Holds the node-free Objective-C extraction retained after a parse session closes.
 *
 * Interface and implementation sites are reconciled only after every selected
 * source is scanned, while this record keeps their physical provenance intact.
 */
export interface IEvidObjcFileAnalysis {
  /**
   * Snapshot source and its logical aliases.
   *
   * Its physical path anchors sites while aliases supply published files.
   */
  source: IEvidSourceFile;

  /**
   * Physical declaration sites before public identity reconciliation.
   *
   * Later materialization merges compatible interface and implementation records.
   */
  declarations: IEvidObjcDeclaration[];

  /**
   * Attached and unsupported documentation carriers.
   *
   * Unsupported tagged carriers remain available for actionable diagnostics.
   */
  documentation: IEvidObjcDocumentation[];

  /**
   * Actionable extraction and parser failures.
   *
   * Consumers retain these findings instead of accepting a smaller inventory.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether all surface-affecting Objective-C forms were classified.
   *
   * A false value protects coverage from incomplete header or implementation
   * extraction by propagating the uncertainty into the final inventory.
   */
  complete: boolean;
}
