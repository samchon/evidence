import type { IEvidenceGraphConfig } from "../structures/IEvidenceGraphConfig";

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    /**
     * Declares this project's evidence graph.
     *
     * The claims define the citing populations and the independently complete
     * evidence references each one must acknowledge.
     */
    "evidence/graph": IEvidenceGraphConfig;
  }
}
