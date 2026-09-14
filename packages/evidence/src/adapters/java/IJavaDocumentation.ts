import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IJavaDocumentationAttachment } from "./IJavaDocumentationAttachment";

/** A Java documentation carrier or tag-bearing unsupported carrier. */
export interface IJavaDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IJavaDocumentationAttachment[];
}
