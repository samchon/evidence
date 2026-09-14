import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ISqlDocumentationAttachment } from "./ISqlDocumentationAttachment";

/** A SQL documentation carrier or tag-bearing unsupported carrier. */
export interface ISqlDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax?: IEvidenceCommentSyntax;

  /** Original-coordinate mapping for a dialect documentation string. */
  mapped?: IEvidenceDocumentation;

  /** Declaration sites to which this documentation attaches. */
  attachments: ISqlDocumentationAttachment[];
}
