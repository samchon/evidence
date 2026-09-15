import type { Node as EvidNode } from "web-tree-sitter";

import type { EvidCDeclaratorKind } from "./EvidCDeclaratorKind";

/**
 * Represents the static information recoverable from one C declarator subtree.
 *
 * C declarations can wrap names in pointer, array, parenthesized, and function
 * declarators. The scanner separates the readable identifier and effective
 * entity kind from the original node so callers can classify it without trying
 * to evaluate C types or macros.
 */
export interface IEvidCDeclaratorShape {
  /**
   * Declared identifier read from the effective direct declarator.
   *
   * The scanner combines it with its enclosing context to create a declaration identity.
   */
  name: string;

  /**
   * Whether the effective declarator denotes a direct, function, or object entity.
   *
   * The scanner routes the shape to callable or object extraction with this classification.
   */
  kind: EvidCDeclaratorKind;

  /**
   * Original declarator subtree used to derive source sites and diagnostics.
   *
   * Retaining the node keeps physical locations tied to the declarator that supplied the name.
   */
  node: EvidNode;
}
