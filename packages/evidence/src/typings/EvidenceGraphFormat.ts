/** Serialization formats accepted by the graph-report command.
 *
 * `json` preserves the report as structured data. `mermaid` and `dot` are
 * visualization languages for rendering the same graph relationships and must
 * not be used as a lossless replacement for the machine-readable report.
 */
export type EvidenceGraphFormat = "json" | "mermaid" | "dot";
