import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IKotlinDocumentationAttachment } from "./IKotlinDocumentationAttachment";

/**
 * Represents a Kotlin documentation carrier or tag-bearing unsupported carrier.
 *
 * KDoc attachment is established from source adjacency, while tagged text in an
 * ineligible carrier remains present for a host-level diagnostic.
 */
export interface IKotlinDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: IKotlinDocumentationAttachment[];
}
