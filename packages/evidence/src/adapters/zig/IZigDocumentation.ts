import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IZigDocumentationAttachment } from "./IZigDocumentationAttachment";

/** A Zig documentation carrier or tag-bearing unsupported carrier. */
export interface IZigDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: IZigDocumentationAttachment[];
}
