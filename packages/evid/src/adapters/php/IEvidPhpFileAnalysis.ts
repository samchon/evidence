import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidPhpDeclaration } from "./IEvidPhpDeclaration";
import type { IEvidPhpDocumentation } from "./IEvidPhpDocumentation";

/**
 * Preserves one PHP file's serializable extraction after parsing.
 *
 * EvidPhpAdapterBase materializes its units only after all selected files have
 * yielded declarations, diagnostics, documentation carriers, and context for
 * digests.
 */
export interface IEvidPhpFileAnalysis {
  /**
   * Selected source snapshot represented by this analysis.
   *
   * Its path anchors declaration identities and diagnostic locations.
   */
  source: IEvidSourceFile;

  /**
   * Lexical declarations awaiting visibility and duplicate reconciliation.
   *
   * Only public, conflict-free entries become inventory units and addresses.
   */
  declarations: IEvidPhpDeclaration[];

  /**
   * PHPDoc carriers with their immediate declaration attachments.
   *
   * Tagged unsupported carriers remain available for diagnostic host creation.
   */
  documentation: IEvidPhpDocumentation[];

  /**
   * Source or classification failures discovered for this file.
   *
   * These prevent a partial public surface from being considered complete.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * File-local imports and directives that affect declaration meaning.
   *
   * Complete inventories fold normalized entries into review content digests.
   */
  context: string[];

  /**
   * Whether every surface-changing construct in this file was classified.
   *
   * The adapter propagates false to reject coverage based on an incomplete
   * population.
   */
  complete: boolean;
}
