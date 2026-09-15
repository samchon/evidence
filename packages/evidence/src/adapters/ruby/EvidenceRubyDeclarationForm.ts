/**
 * Enumerates Ruby source forms retained until public units are materialized.
 *
 * EvidenceRubyFileScanner assigns the form to each lexical record.
 * EvidenceRubyAdapter uses it with runtime names and ownership to apply
 * form-specific reopening and replacement rules.
 */
export type EvidenceRubyDeclarationForm =
  | "alias"
  | "attribute"
  | "class"
  | "constant"
  | "method"
  | "module"
  | "module-function"
  | "singleton-method";
