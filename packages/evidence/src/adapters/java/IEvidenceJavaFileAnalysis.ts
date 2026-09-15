import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceJavaDeclaration } from "./IEvidenceJavaDeclaration";
import type { IEvidenceJavaDocumentation } from "./IEvidenceJavaDocumentation";

/**
 * Stores a node-free extraction of one Java source file after parsing closes.
 *
 * EvidenceJavaAdapter aggregates these records to reconcile overload families,
 * attach Javadoc hosts, and preserve extraction failures in the final
 * inventory.
 */
export interface IEvidenceJavaFileAnalysis {
  /**
   * Source snapshot owning all extracted Java records.
   *
   * Its configured paths later receive the published accessor addresses.
   */
  source: IEvidenceSourceFile;

  /**
   * Declarations awaiting family reconciliation and public filtering.
   *
   * Records retain sites after the parser session has closed.
   */
  declarations: IEvidenceJavaDeclaration[];

  /**
   * Javadoc carriers with scanner-proven declaration attachments.
   *
   * Annotation-bearing but unsupported carriers remain diagnosable.
   */
  documentation: IEvidenceJavaDocumentation[];

  /**
   * Extraction errors that must survive into the inventory.
   *
   * They prevent partial parsing from becoming passing smaller coverage.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether the scanner represented every relevant supported construct.
   *
   * The adapter carries this status through final inventory validation.
   */
  complete: boolean;
}
