import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidLuaDocumentationAttachment } from "./IEvidLuaDocumentationAttachment";

/**
 * Represents a Lua documentation carrier or tag-bearing unsupported carrier.
 *
 * LuaDoc is retained independently of static value resolution so annotations on
 * dynamic or detached source can be reported truthfully rather than discarded.
 */
export interface IEvidLuaDocumentation {
  /** Identifies this physical Lua documentation carrier within the scanned file.
   *
   * Attachments and generated hosts use this scanner-local ID, which does not name a semantic declaration.
   */
  id: string;

  /** Locates the carrier's original half-open UTF-16 source span.
   *
   * The adapter preserves this range for diagnostics and annotation-range exclusion.
   */
  range: IEvidSourceRange;

  /** Defines the delimiters and annotation-reading rules for this comment carrier.
   *
   * Documentation parsing uses the syntax instead of guessing from raw Lua source text.
   */
  syntax: IEvidCommentSyntax;

  /** Lists declaration sites that accept this carrier as attached LuaDoc.
   *
   * The scanner establishes attachment from source adjacency before static value reconciliation.
   */
  attachments: IEvidLuaDocumentationAttachment[];
}
