import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidObjcDocumentationAttachment } from "./IEvidObjcDocumentationAttachment";

/**
 * Represents a Doxygen documentation carrier or unsupported annotation-bearing
 * comment.
 *
 * Attachment is determined before interface and implementation sites merge, so
 * tagged ordinary comments remain available for an accurate host diagnostic.
 */
export interface IEvidObjcDocumentation {
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
  range: IEvidSourceRange;

  /**
   * Mapped comment delimiters and withdrawal eligibility.
   *
   * Tag parsing uses the syntax mapping to preserve carrier-specific
   * boundaries.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Declaration sites receiving this carrier.
   *
   * Each attachment retains its physical owner before semantic-unit merging.
   */
  attachments: IEvidObjcDocumentationAttachment[];
}
