import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceRubyDeclaration } from "./IEvidenceRubyDeclaration";
import type { IEvidenceRubyDocumentation } from "./IEvidenceRubyDocumentation";

/**
 * Preserves one Ruby file's serializable extraction after parsing.
 *
 * EvidenceRubyAdapter merges all analyses to reconcile reopened declarations,
 * visibility, documentation attachment, and failures without retaining
 * Tree-sitter nodes.
 */
export interface IEvidenceRubyFileAnalysis {
  /**
   * Selected source snapshot represented by this analysis.
   *
   * Its addresses define the files through which materialized units are
   * published.
   */
  source: IEvidenceSourceFile;

  /**
   * Lexical declarations awaiting reopening and public-owner reconciliation.
   *
   * Multiple entries may collapse into one semantic Ruby identity.
   */
  declarations: IEvidenceRubyDeclaration[];

  /**
   * Comment carriers and their immediate declaration attachments.
   *
   * Attachment is deferred until the destination declaration group is public.
   */
  documentation: IEvidenceRubyDocumentation[];

  /**
   * Classification failures that make this source population incomplete.
   *
   * The final inventory retains them instead of silently omitting uncertain
   * APIs.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether scanning fully classified this file's declared surface.
   *
   * False propagates through the merged inventory even when other files parse.
   */
  complete: boolean;
}
