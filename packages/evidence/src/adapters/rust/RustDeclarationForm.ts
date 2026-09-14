/**
 * Enumerates supported Rust source forms that establish semantic declarations.
 *
 * RustFileScanner assigns these forms to lexical records. RustModuleResolver uses
 * them to apply module, associated-item, and public-occurrence ownership rules.
 */
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
