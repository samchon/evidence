import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidPhpDocumentationAttachment } from "./IEvidPhpDocumentationAttachment";

/**
 * Retains one PHPDoc carrier, including a carrier whose placement is unsupported.
 *
 * The adapter preserves unsupported tagged text as a diagnostic host so directives
 * cannot disappear merely because no eligible declaration receives the comment.
 */
export interface IEvidPhpDocumentation {
  /**
   * Stable scanner identity for this documentation region.
   *
   * It distinguishes host records even when nearby declarations share a site.
   */
  id: string;

  /**
   * Original UTF-16 range occupied by the PHPDoc comment.
   *
   * Annotation ranges exclude it from declaration review fingerprints.
   */
  range: IEvidSourceRange;

  /**
   * Delimiter and tag-boundary rules used to map the carrier's text.
   *
   * EvidPhpDocumentation also uses this classification to mask examples without moving offsets.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Declaration sites to which this carrier is immediately attached.
   *
   * A comment can serve multiple units at one site before withdrawal hides descendants.
   */
  attachments: IEvidPhpDocumentationAttachment[];
}
