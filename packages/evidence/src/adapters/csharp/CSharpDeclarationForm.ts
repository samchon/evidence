/**
 * Enumerates C# source forms that establish supported semantic declarations.
 *
 * CSharpFileScanner uses the form to select identity and ownership rules before
 * public accessibility filtering determines the published graph population.
 */
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
