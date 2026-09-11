import type { IEvidenceCommentSyntax } from "../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { IRustDocumentationAttachment } from "./IRustDocumentationAttachment";

/** A Rust documentation carrier or tag-bearing unsupported carrier. */
export interface IRustDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IRustDocumentationAttachment[];
  innerModulePath?: string[];
}
