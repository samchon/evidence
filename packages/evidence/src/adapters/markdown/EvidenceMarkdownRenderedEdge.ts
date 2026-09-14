/**
 * Whether one Markdown line opens or closes a rendered code region.
 *
 * Markdown annotation scanning carries this state between lines so tags inside
 * HTML preformatted or rendered-template code are not treated as evidence.
 */
export type EvidenceMarkdownRenderedEdge = "open" | "close" | "both" | "none";
