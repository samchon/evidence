/**
 * A Markdown node kind that can become an evidence unit or bear an evidence
 * declaration.
 *
 * `file` treats a document as one node. Heading kinds select the corresponding
 * heading sections, so a configuration can make its evidence granularity and
 * declaration hosts explicit without encoding that decision in glob patterns.
 *
 * - `"file"` selects the Markdown document itself.
 * - `"h1"` through `"h4"` select sections headed at that ATX level.
 */
export type EvidenceGraphMarkdownSymbol = "file" | "h1" | "h2" | "h3" | "h4";
