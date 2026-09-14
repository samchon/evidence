import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IPythonDocumentationAttachment } from "./IPythonDocumentationAttachment";

/** A Python docstring or adjacent comment run and its declaration attachment. */
export interface IPythonDocumentation {
  id: string;
  range: IEvidenceSourceRange;
  syntax?: IEvidenceCommentSyntax;
  mapping?: IEvidenceDocumentation;
  attachments: IPythonDocumentationAttachment[];
}
