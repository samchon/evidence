import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPhpDeclaration } from "./IPhpDeclaration";
import type { IPhpDocumentation } from "./IPhpDocumentation";

/**
 * Preserves one PHP file's serializable extraction after parsing.
 *
 * PhpAdapter materializes its units only after all selected files have yielded
 * declarations, diagnostics, documentation carriers, and context for digests.
 */
export interface IPhpFileAnalysis {
  /**
   * Selected source snapshot represented by this analysis.
   *
   * Its path anchors declaration identities and diagnostic locations.
   */
  source: IEvidenceSourceFile;

  /**
   * Lexical declarations awaiting visibility and duplicate reconciliation.
   *
   * Only public, conflict-free entries become inventory units and addresses.
   */
  declarations: IPhpDeclaration[];

  /**
   * PHPDoc carriers with their immediate declaration attachments.
   *
   * Tagged unsupported carriers remain available for diagnostic host creation.
   */
  documentation: IPhpDocumentation[];

  /**
   * Source or classification failures discovered for this file.
   *
   * These prevent a partial public surface from being considered complete.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * File-local imports and directives that affect declaration meaning.
   *
   * Complete inventories fold normalized entries into review content digests.
   */
  context: string[];

  /**
   * Whether every surface-changing construct in this file was classified.
   *
   * The adapter propagates false to reject coverage based on an incomplete population.
   */
  complete: boolean;
}
