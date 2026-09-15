import type { IEvidenceCppDeclaration } from "./IEvidenceCppDeclaration";

/**
 * Collects C++ declaration occurrences that materialize one semantic unit.
 *
 * EvidenceCppAdapter builds these groups from scanner records using `id`, then uses
 * their declarations to determine public ownership, validate compatible
 * declaration and definition families, and construct the unit's sites. It
 * bridges physical IEvidenceCppDeclaration records and the final evidence inventory.
 */
export interface IEvidenceCppDeclarationGroup {
  /**
   * Semantic unit ID shared by every declaration in this group.
   *
   * EvidenceCppAdapter derives it from the declarations' symbol and qualified
   * identity before using it as the unit ID and as the key for public-group
   * selection.
   */
  id: string;

  /**
   * Physical declaration occurrences assigned to the semantic unit.
   *
   * The adapter compares their forms, visibility, and definitions before it
   * copies selected sites and public addresses into the materialized unit.
   */
  declarations: IEvidenceCppDeclaration[];
}
