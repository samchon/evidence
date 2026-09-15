/**
 * Supported source form that establishes one Go semantic declaration.
 *
 * The Go scanner assigns this classification before materialization so type
 * aliases, members, and standalone declarations retain their distinct
 * semantics.
 */
export type EvidGoDeclarationForm =
  | "defined-type"
  | "type-alias"
  | "function"
  | "method"
  | "property"
  | "field"
  | "interface-method";
