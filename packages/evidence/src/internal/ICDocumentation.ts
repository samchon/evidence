import type { IEvidenceCommentSyntax } from "../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { ICDocumentationAttachment } from "./ICDocumentationAttachment";

/** A C Doxygen carrier or tag-bearing unsupported carrier. */
export interface ICDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: ICDocumentationAttachment[];
}
