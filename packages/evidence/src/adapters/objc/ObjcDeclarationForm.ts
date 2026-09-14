/**
 * Distinguishes public declarations from implementation and extension sites.
 *
 * Reconciliation uses the form to determine which physical records can establish
 * an identity and which can only contribute compatible implementation content.
 */
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
