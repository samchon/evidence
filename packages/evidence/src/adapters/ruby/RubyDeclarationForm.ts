/**
 * Enumerates Ruby source forms retained until public units are materialized.
 *
 * RubyFileScanner assigns the form to each lexical record. RubyAdapter uses it
 * with runtime names and ownership to apply form-specific reopening and replacement rules.
 */
export type RubyDeclarationForm =
  | "alias"
  | "attribute"
  | "class"
  | "constant"
  | "method"
  | "module"
  | "module-function"
  | "singleton-method";
