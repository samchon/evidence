/** Supported Rust source form that establishes one semantic declaration. */
export type RustDeclarationForm =
  | "module"
  | "struct"
  | "enum"
  | "trait"
  | "type-alias"
  | "function"
  | "constant"
  | "static"
  | "field"
  | "tuple-field"
  | "enum-variant"
  | "trait-method"
  | "trait-constant"
  | "trait-type"
  | "impl-method"
  | "impl-constant"
  | "impl-type";
