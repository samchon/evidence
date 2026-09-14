import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ICppDocumentationAttachment } from "./ICppDocumentationAttachment";

/** A C++ Doxygen carrier or tag-bearing unsupported carrier. */
export interface ICppDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: ICppDocumentationAttachment[];
}
