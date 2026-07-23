import type { IEvidenceGraphMarkdownReference } from "./IEvidenceGraphMarkdownReference";
import type { IEvidenceGraphSwaggerReference } from "./IEvidenceGraphSwaggerReference";
import type { IEvidenceGraphTypeScriptReference } from "./IEvidenceGraphTypeScriptReference";

/**
 * One population of evidence units that a claim must cite completely.
 *
 * A reference selects what counts as evidence: Markdown documents and heading
 * sections, Swagger or OpenAPI operations, or selected exported TypeScript
 * symbols. Every unit it materializes must be acknowledged by the owning claim,
 * so a reference is the denominator of one coverage obligation, never a pooled
 * global set.
 */
export type IEvidenceGraphReference =
  | IEvidenceGraphMarkdownReference
  | IEvidenceGraphSwaggerReference
  | IEvidenceGraphTypeScriptReference;
