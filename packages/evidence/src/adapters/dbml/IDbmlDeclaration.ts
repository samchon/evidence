import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** One declaration extracted from the DBML syntax tree.
 *
 * The scanner copies only stable declaration facts so later cross-file alias
 * resolution can materialize units after the parser session is closed.
 */
export interface IDbmlDeclaration {
  /** File-independent schema identity.
   *
   * This names semantic ownership and is deliberately distinct from a source
   * range, which can appear in more than one selected file.
   */
  identity: string[];

  /**
   * Selects a model, scalar column, or separate relation declaration.
   *
   * The adapter maps this selector to the public database unit symbol.
   */
  symbol: EvidenceDatabaseSymbol;

  /** Whitespace-independent syntax tokens excluding documentation.
   *
   * The adapter fingerprints this value so annotation edits do not invalidate
   * the schema declaration they describe.
   */
  content: string;

  /**
   * Stores the exact original declaration span used for its physical site.
   *
   * This range anchors documentation and diagnostics in the selected source file.
   */
  range: IEvidenceSourceRange;

  /** Explicit table alias, when declared.
   *
   * Omission means endpoint resolution uses the declaration's table identity.
   */
  alias?: string;
}
