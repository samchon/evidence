import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidGoDeclaration } from "./IEvidGoDeclaration";
import type { IEvidGoDocumentation } from "./IEvidGoDocumentation";

/**
 * Stores a node-free extraction of one Go source file after parsing closes.
 *
 * EvidGoAdapterBase collects these file fragments, while EvidGoPackageResolver uses their
 * directory and package context to publish package-wide evidence units.
 */
export interface IEvidGoFileAnalysis {
  /**
   * Source snapshot from which this package fragment was extracted.
   *
   * Its addresses become public file paths after package reconciliation.
   */
  source: IEvidSourceFile;

  /**
   * Normalized directory used to group Go files into one package scope.
   *
   * Directory identity prevents same-named packages from being merged globally.
   */
  directory: string;

  /**
   * Package clause name when the source supplied a statically readable clause.
   *
   * Omission is an extraction failure, not an empty package.
   */
  packageName?: string;

  /**
   * Whether this file belongs to Go's test package surface.
   *
   * Package materialization uses it to preserve Go's separate test visibility.
   */
  testFile: boolean;

  /**
   * Exported declaration records awaiting package-wide receiver resolution.
   *
   * Records remain physical so their documentation sites stay distinct.
   */
  declarations: IEvidGoDeclaration[];

  /**
   * Comment runs and their scanner-established declaration attachments.
   *
   * Unattached annotation carriers are retained for actionable diagnostics.
   */
  documentation: IEvidGoDocumentation[];

  /**
   * Problems that make this package fragment incomplete.
   *
   * The adapter preserves them instead of silently dropping declarations.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether relevant supported source constructs were fully extracted.
   *
   * False propagates through package materialization to coverage evaluation.
   */
  complete: boolean;
}
