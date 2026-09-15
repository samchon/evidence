/**
 * Enumerates C source forms that can establish an Evid declaration.
 *
 * Materialization uses the form to determine compatible repeats, ownership, and
 * public address policy. Unsupported syntax is diagnosed by the scanner instead
 * of being coerced into one of these categories.
 */
export type EvidCDeclarationForm =
  | "struct"
  | "union"
  | "enum"
  | "typedef"
  | "function"
  | "object"
  | "field"
  | "enumerator";
