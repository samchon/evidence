import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEcmaScriptCommentAttachment } from "./IEcmaScriptCommentAttachment";

/** One parsed comment and any declaration positions that accept it as JSDoc. */
export interface IEcmaScriptComment {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: IEcmaScriptCommentAttachment[];
}
