/**
 * Identifies the C# type context that governs nested ownership and visibility.
 *
 * The scanner carries this context into member extraction to apply
 * type-specific accessibility defaults and construct public address segments
 * consistently.
 */
export type EvidenceCSharpTypeKind =
  "class" | "struct" | "interface" | "record" | "enum" | "delegate";
