/**
 * Markdown document and section kinds.
 *
 * - "file": the document root.
 * - "h1" through "h4": ATX sections at exactly that level. Setext and H5/H6
 *   headings are excluded.
 * - A section contains lower-level sections up to the next equal/higher heading.
 *   Ordinary evidence and permitted exclusions cover selected descendants;
 *   unselected ancestors remain addressable as aggregate targets.
 *
 * Target rules:
 *
 * - File paths are relative to the reference root. Both path separators are
 *   accepted, but paths cannot contain whitespace.
 * - Sections append "#<anchor>" to the file path.
 *   - An explicit "{#anchor}" wins. It starts with an ASCII letter/digit, followed
 *     by ASCII letters/digits, ".", "_", ":", or "-".
 *   - Otherwise, lowercase the heading; retain letters, numbers, and "_"; collapse
 *     whitespace/hyphens to "-"; remove other punctuation.
 * - Duplicate selected heading targets are ambiguous and need explicit anchors.
 */
export type EvidenceMarkdownSymbol = "file" | "h1" | "h2" | "h3" | "h4";
