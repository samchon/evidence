import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ICSharpDocumentationAttachment } from "./ICSharpDocumentationAttachment";

/** A C# XML documentation carrier or tag-bearing unsupported carrier. */
export interface ICSharpDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: ICSharpDocumentationAttachment[];
}
