/**
 * Java type context that determines implicit member visibility.
 *
 * Member extraction carries this context because interfaces, annotations, and
 * other nominal forms supply different defaults when modifiers are omitted.
 */
export type EvidJavaTypeKind =
  "class" | "interface" | "enum" | "annotation" | "record";
