/**
 * Enumerates supported Rust source forms that establish semantic declarations.
 *
 * EvidenceRustFileScanner assigns these forms to lexical records.
 * EvidenceRustModuleResolver uses them to apply module, associated-item, and
 * public-occurrence ownership rules.
 */
export type EvidenceRustDeclarationForm =
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
