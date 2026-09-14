import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ISwiftDocumentationAttachment } from "./ISwiftDocumentationAttachment";

/**
 * Represents a Swift documentation carrier or tag-bearing unsupported carrier.
 *
 * Its physical range stays independent of nominal reconciliation, preserving a
 * DocC host at the extension site that originally carries the annotation.
 */
export interface ISwiftDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: ISwiftDocumentationAttachment[];
}
