/** Supported C# source form that establishes one semantic declaration. */
export type CSharpDeclarationForm =
  | "class"
  | "struct"
  | "interface"
  | "record"
  | "record-struct"
  | "enum"
  | "delegate"
  | "method"
  | "field"
  | "property"
  | "event"
  | "enum-member"
  | "indexer"
  | "operator"
  | "conversion-operator";
