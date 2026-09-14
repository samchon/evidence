import type { IEvidenceCheckAnalysis } from "../structures/IEvidenceCheckAnalysis";
import type { EvidenceQueryPopulationContext } from "./EvidenceQueryPopulationContext";

/** One owned analysis snapshot and the indexes shared by its query operations. */
export interface IEvidenceQueryContext {
  /** Analysis snapshot isolated from caller mutations. */
  readonly analysis: IEvidenceCheckAnalysis;

  /** Absolute base directory for rendering and resolving query targets. */
  readonly cwd: string;

  /** Claim and reference indexes reused across this facade's query operations. */
  readonly populations: EvidenceQueryPopulationContext[];
}
