import type { ICppDeclaration } from "./ICppDeclaration";

/**
 * Collects C++ declaration occurrences that materialize one semantic unit.
 *
 * CppAdapter builds these groups from scanner records using `id`, then uses
 * their declarations to determine public ownership, validate compatible
 * declaration and definition families, and construct the unit's sites. It
 * bridges physical ICppDeclaration records and the final Evidence inventory.
 */
export interface ICppDeclarationGroup {
  /**
   * Semantic unit ID shared by every declaration in this group.
   *
   * CppAdapter derives it from the declarations' symbol and qualified identity
   * before using it as the unit ID and as the key for public-group selection.
   */
  id: string;

  /**
   * Physical declaration occurrences assigned to the semantic unit.
   *
   * The adapter compares their forms, visibility, and definitions before it
   * copies selected sites and public addresses into the materialized unit.
   */
  declarations: ICppDeclaration[];
}
