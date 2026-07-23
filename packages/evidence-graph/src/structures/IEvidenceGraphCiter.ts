import type { IEvidenceGraphMarkdownCiter } from "./IEvidenceGraphMarkdownCiter";
import type { IEvidenceGraphTypeScriptCiter } from "./IEvidenceGraphTypeScriptCiter";

/**
 * One independently complete population of artifacts that must cite its owning
 * source.
 *
 * A citer group is the incoming side of an evidence edge: it says who bears the
 * responsibility to explain why the source matters. Separate citer groups
 * remain separate obligations, preventing two teams' partial use of the same
 * evidence from being reported as one complete use.
 */
export type IEvidenceGraphCiter =
  IEvidenceGraphMarkdownCiter | IEvidenceGraphTypeScriptCiter;
