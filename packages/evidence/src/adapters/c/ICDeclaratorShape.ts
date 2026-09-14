import type { Node } from "web-tree-sitter";

import type { CDeclaratorKind } from "./CDeclaratorKind";

/**
 * Represents the static information recoverable from one C declarator subtree.
 *
 * C declarations can wrap names in pointer, array, parenthesized, and function
 * declarators. The scanner separates the readable identifier and effective
 * entity kind from the original node so callers can classify it without trying
 * to evaluate C types or macros.
 */
export interface ICDeclaratorShape {
  /** Declared identifier read from the effective direct declarator. */
  name: string;

  /** Whether the effective declarator denotes a direct, function, or object entity. */
  kind: CDeclaratorKind;

  /** Original declarator subtree used to derive source sites and diagnostics. */
  node: Node;
}
