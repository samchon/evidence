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
  /** Stable physical carrier identifier. */
  id: string;

  /** Original UTF-16 range, including comment delimiters. */
  range: IEvidenceSourceRange;

  /** Mapped comment delimiters and withdrawal eligibility. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites receiving this carrier. */
  attachments: IObjcDocumentationAttachment[];
}
