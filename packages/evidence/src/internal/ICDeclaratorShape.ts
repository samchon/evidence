import type { Node } from "web-tree-sitter";

import type { CDeclaratorKind } from "./CDeclaratorKind";

/** Statically readable name and entity kind for one C declarator. */
export interface ICDeclaratorShape {
  name: string;
  kind: CDeclaratorKind;
  node: Node;
}
