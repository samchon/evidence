import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IGoDocumentationAttachment } from "./IGoDocumentationAttachment";

/** A Go comment run or tag-bearing literal and its declaration attachments. */
export interface IGoDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IGoDocumentationAttachment[];
}
