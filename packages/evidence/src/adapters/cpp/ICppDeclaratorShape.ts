import type { Node } from "web-tree-sitter";

import type { CppDeclaratorKind } from "./CppDeclaratorKind";

/**
 * Describes the readable name and outer entity kind of one C++ declarator.
 *
 * CppSyntax derives this transient tree-sitter-backed shape while unwrapping a
 * declarator. CppFileScanner consumes it to classify callable and object
 * declarations, construct their identities, and reject specializations that
 * cannot use the adapter's common addressing model.
 */
export interface ICppDeclaratorShape {
  /**
   * Qualified declarator segments as the grammar exposes them.
   *
   * CppFileScanner combines this path with the enclosing scope when needed,
   * then uses the final segment for the declaration name and the preceding
   * segments to identify its semantic parent.
   */
  path: string[];

  /**
   * Outermost declaration category inferred while unwrapping the declarator.
   *
   * The scanner uses this category to route the shape to callable or object
   * extraction instead of inferring that distinction from the name alone.
   */
  kind: CppDeclaratorKind;

  /**
   * Original declarator node retained for source-site extraction.
   *
   * CppFileScanner passes this node to declaration creation so the physical
   * site follows the declarator even when an enclosing syntax node supplied
   * the readable path.
   */
  node: Node;

  /**
   * Whether the readable path denotes a specialized template entity.
   *
   * Specialized declarations are reported as unsupported because they cannot
   * share the primary template's common public accessor.
   */
  specialized: boolean;
}
