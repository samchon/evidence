import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IObjcDocumentationAttachment } from "./IObjcDocumentationAttachment";

/**
 * Represents a Doxygen documentation carrier or unsupported annotation-bearing comment.
 *
 * Attachment is determined before interface and implementation sites merge, so
 * tagged ordinary comments remain available for an accurate host diagnostic.
 */
export interface IObjcDocumentation {
  /**
   * Stable physical carrier identifier.
   *
   * It keeps this comment distinct before its attachments are reconciled.
   */
  id: string;

  /**
   * Original UTF-16 range, including comment delimiters.
   *
   * Documentation mapping and host coordinates use this unmodified source span.
   */
  range: IEvidenceSourceRange;

  /**
   * Mapped comment delimiters and withdrawal eligibility.
   *
   * Tag parsing uses the syntax mapping to preserve carrier-specific boundaries.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Declaration sites receiving this carrier.
   *
   * Each attachment retains its physical owner before semantic-unit merging.
   */
  attachments: IObjcDocumentationAttachment[];
}
