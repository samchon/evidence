/**
 * Enumerates C++ source forms that establish supported semantic declarations.
 *
 * EvidCppFileScanner uses the form to choose identity, ownership, visibility,
 * and address behavior while unsupported grammar forms remain incomplete
 * diagnostics.
 */
export type EvidCppDeclarationForm =
  | "namespace"
  | "class"
  | "struct"
  | "union"
  | "enum"
  | "alias"
  | "typedef"
  | "concept"
  | "function"
  | "constructor"
  | "destructor"
  | "operator"
  | "conversion"
  | "variable"
  | "field"
  | "static-field"
  | "enumerator";
