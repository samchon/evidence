/** Distinguishes public declarations from implementation and extension sites. */
export type ObjcDeclarationForm =
  | "interface"
  | "protocol"
  | "category"
  | "extension"
  | "implementation"
  | "method"
  | "property"
  | "ivar"
  | "function";
