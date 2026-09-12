/** Supported C++ source form that establishes one semantic declaration. */
export type CppDeclarationForm =
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
