import type { IEvidenceGraphMarkdownReference } from "./IEvidenceGraphMarkdownReference";
import type { IEvidenceGraphTypeScriptReference } from "./IEvidenceGraphTypeScriptReference";

/**
 * One independently complete population of artifacts that must cite its owning
 * source.
 *
 * A reference is the reverse side of an evidence edge: it says who bears the
 * responsibility to explain why the source matters. Separate reference groups
 * remain separate obligations, preventing two teams' partial use of the same
 * evidence from being reported as one complete use.
 */
export type IEvidenceGraphReference =
  IEvidenceGraphMarkdownReference | IEvidenceGraphTypeScriptReference;
