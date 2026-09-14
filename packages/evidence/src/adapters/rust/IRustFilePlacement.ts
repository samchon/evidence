import type { IRustFileAnalysis } from "./IRustFileAnalysis";

/** One selected Rust file assigned to a crate root and module prefix. */
export interface IRustFilePlacement {
  analysis: IRustFileAnalysis;
  rootKey: string;
  prefix: string[];
  moduleDeclarationId?: string;
}
