/**
 * Enumerates Ruby source forms retained until public units are materialized.
 *
 * EvidRubyFileScanner assigns the form to each lexical record.
 * EvidRubyAdapter uses it with runtime names and ownership to apply
 * form-specific reopening and replacement rules.
 */
export type EvidRubyDeclarationForm =
  | "alias"
  | "attribute"
  | "class"
  | "constant"
  | "method"
  | "module"
  | "module-function"
  | "singleton-method";
