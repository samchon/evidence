import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IPhpDocumentationAttachment } from "./IPhpDocumentationAttachment";

/** A PHP documentation carrier or tag-bearing unsupported carrier. */
export interface IPhpDocumentation {
  /** Stable extraction identity. */
  id: string;

  /** Original UTF-16 source range. */
  range: IEvidenceSourceRange;

  /** Classified PHPDoc delimiters. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites owned by this carrier. */
  attachments: IPhpDocumentationAttachment[];
}
