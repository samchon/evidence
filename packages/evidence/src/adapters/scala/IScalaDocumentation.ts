import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IScalaDocumentationAttachment } from "./IScalaDocumentationAttachment";

/**
 * Represents a Scala documentation carrier or tag-bearing unsupported carrier.
 *
 * Scaladoc remains tied to its physical declaration site while later export
 * resolution may add addresses for the same semantic declaration.
 */
export interface IScalaDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: IScalaDocumentationAttachment[];
}
