import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ILuaDocumentationAttachment } from "./ILuaDocumentationAttachment";

/**
 * Represents a Lua documentation carrier or tag-bearing unsupported carrier.
 *
 * LuaDoc is retained independently of static value resolution so annotations on
 * dynamic or detached source can be reported truthfully rather than discarded.
 */
export interface ILuaDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: ILuaDocumentationAttachment[];
}
