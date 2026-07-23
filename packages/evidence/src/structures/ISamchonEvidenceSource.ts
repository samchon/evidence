import type { ISamchonEvidenceMarkdownSource } from "./ISamchonEvidenceMarkdownSource";
import type { ISamchonEvidenceTypeScriptSource } from "./ISamchonEvidenceTypeScriptSource";

/**
 * One origin of evidence nodes in the graph.
 *
 * Markdown contributes sections that state a human-readable rule, while
 * TypeScript contributes selected exported symbols that state a
 * machine-checkable contract. Both are sources because the graph asks the same
 * question of each: which other artifacts can demonstrate that this claim is
 * actually used?
 */
export type ISamchonEvidenceSource =
  ISamchonEvidenceMarkdownSource | ISamchonEvidenceTypeScriptSource;
