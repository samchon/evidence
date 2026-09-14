import type { Node } from "web-tree-sitter";

import type { CppDeclaratorKind } from "./CppDeclaratorKind";

/** Statically readable qualified name and entity kind for one C++ declarator. */
export interface ICppDeclaratorShape {
  path: string[];
  kind: CppDeclaratorKind;
  node: Node;
  specialized: boolean;
}
