import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidRubyDeclaration } from "./IEvidRubyDeclaration";
import type { IEvidRubyDocumentation } from "./IEvidRubyDocumentation";

/**
 * Preserves one Ruby file's serializable extraction after parsing.
 *
 * EvidRubyAdapterBase merges all analyses to reconcile reopened declarations, visibility,
 * documentation attachment, and failures without retaining Tree-sitter nodes.
 */
export interface IEvidRubyFileAnalysis {
  /**
   * Selected source snapshot represented by this analysis.
   *
   * Its addresses define the files through which materialized units are published.
   */
  source: IEvidSourceFile;

  /**
   * Lexical declarations awaiting reopening and public-owner reconciliation.
   *
   * Multiple entries may collapse into one semantic Ruby identity.
   */
  declarations: IEvidRubyDeclaration[];

  /**
   * Comment carriers and their immediate declaration attachments.
   *
   * Attachment is deferred until the destination declaration group is public.
   */
  documentation: IEvidRubyDocumentation[];

  /**
   * Classification failures that make this source population incomplete.
   *
   * The final inventory retains them instead of silently omitting uncertain APIs.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether scanning fully classified this file's declared surface.
   *
   * False propagates through the merged inventory even when other files parse.
   */
  complete: boolean;
}
