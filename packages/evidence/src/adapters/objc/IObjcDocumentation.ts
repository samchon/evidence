import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IObjcDocumentationAttachment } from "./IObjcDocumentationAttachment";

/** A Objc documentation carrier or tag-bearing unsupported carrier. */
export interface IObjcDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IObjcDocumentationAttachment[];
}
