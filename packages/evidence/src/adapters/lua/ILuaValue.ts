import type { Node } from "web-tree-sitter";
import type { ILuaDeclaration } from "./ILuaDeclaration";

/** Borrowed static value used only during a Lua parse callback. */
export interface ILuaValue {
  /** Value category without executing Lua. */
  kind: "table" | "function" | "literal";

  /** Original value declaration used for identity and content. */
  node: Node;

  /** Static table fields, empty for scalar and callable values. */
  fields: Map<string, ILuaValue>;

  /** First public path establishes semantic ownership. */
  declaration?: ILuaDeclaration;
}
