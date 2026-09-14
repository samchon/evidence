import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IPhpDocumentationAttachment } from "./IPhpDocumentationAttachment";

/** A Php documentation carrier or tag-bearing unsupported carrier. */
export interface IPhpDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IPhpDocumentationAttachment[];
}
