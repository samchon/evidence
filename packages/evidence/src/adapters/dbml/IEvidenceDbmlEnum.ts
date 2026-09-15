import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/**
 * Retains DBML enum semantics that affect dependent table fingerprints.
 *
 * Enums are not independently selectable evidence units, so their semantic
 * content travels with declarations that refer to them.
 */
export interface IEvidenceDbmlEnum {
  /**
   * Names the enum using its qualified DBML identity.
   *
   * Identifier spelling is preserved for matching table-field references.
   */
  identity: string[];

  /**
   * Stores whitespace-independent enum tokens without documentation.
   *
   * This value contributes schema meaning while ignoring annotation-only
   * changes.
   */
  content: string;

  /**
   * Locates the enum declaration in the source file.
   *
   * Diagnostics use the range when an enum dependency cannot be applied.
   */
  range: IEvidenceSourceRange;
}
