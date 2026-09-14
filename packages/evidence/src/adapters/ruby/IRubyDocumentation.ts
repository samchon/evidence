import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IRubyDocumentationAttachment } from "./IRubyDocumentationAttachment";

/** An adjacent Ruby comment run or unsupported literal containing annotations. */
export interface IRubyDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax?: IEvidenceCommentSyntax;
  mapping?: IEvidenceDocumentation;
  attachments: IRubyDocumentationAttachment[];
}
