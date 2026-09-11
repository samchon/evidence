import type { IEvidenceCommentSyntax } from "../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { ITypeScriptCommentAttachment } from "./ITypeScriptCommentAttachment";

/** One parsed comment and any declaration positions that accept it as JSDoc. */
export interface ITypeScriptComment {
  id: string;
  range: IEvidenceSourceRange;
  syntax: IEvidenceCommentSyntax;
  attachments: ITypeScriptCommentAttachment[];
}
