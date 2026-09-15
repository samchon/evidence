import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidJavaDeclaration } from "./IEvidJavaDeclaration";
import type { IEvidJavaDocumentation } from "./IEvidJavaDocumentation";

/**
 * Stores a node-free extraction of one Java source file after parsing closes.
 *
 * EvidJavaAdapterBase aggregates these records to reconcile overload families, attach
 * Javadoc hosts, and preserve extraction failures in the final inventory.
 */
export interface IEvidJavaFileAnalysis {
  /**
   * Source snapshot owning all extracted Java records.
   *
   * Its configured paths later receive the published accessor addresses.
   */
  source: IEvidSourceFile;

  /**
   * Declarations awaiting family reconciliation and public filtering.
   *
   * Records retain sites after the parser session has closed.
   */
  declarations: IEvidJavaDeclaration[];

  /**
   * Javadoc carriers with scanner-proven declaration attachments.
   *
   * Annotation-bearing but unsupported carriers remain diagnosable.
   */
  documentation: IEvidJavaDocumentation[];

  /**
   * Extraction errors that must survive into the inventory.
   *
   * They prevent partial parsing from becoming passing smaller coverage.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether the scanner represented every relevant supported construct.
   *
   * The adapter carries this status through final inventory validation.
   */
  complete: boolean;
}
