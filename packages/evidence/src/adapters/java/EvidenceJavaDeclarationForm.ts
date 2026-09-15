/**
 * Supported Java source form that establishes one semantic declaration.
 *
 * The Java scanner records this form to apply the correct visibility,
 * ownership, and materialization rules to nominal types and their members.
 */
export type EvidenceJavaDeclarationForm =
  | "class"
  | "interface"
  | "enum"
  | "annotation"
  | "record"
  | "method"
  | "field"
  | "interface-constant"
  | "record-component"
  | "enum-constant"
  | "annotation-element";
