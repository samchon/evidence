import type { IEvidCheckAnalysis } from "../structures/IEvidCheckAnalysis";
import type { EvidQueryPopulationContext } from "./EvidQueryPopulationContext";

/**
 * Owned query state shared by list, inspect, and graph programmers.
 *
 * The EvidQuery facade clones analysis before constructing this context and
 * clones reports before returning them. Population indexes can therefore cache
 * traversal results without depending on caller-owned mutable inventory data.
 */
export interface IEvidQueryContext {
  /**
   * Complete analysis bundle captured by the query facade.
   *
   * Its plan, inventories, graph input, and report remain aligned throughout the
   * lifetime of the population indexes.
   */
  readonly analysis: IEvidCheckAnalysis;

  /**
   * Absolute directory anchoring file-qualified query targets.
   *
   * Capturing it once prevents later cwd changes from altering target formatting
   * or inspection within the same facade.
   */
  readonly cwd: string;

  /**
   * Claim and reference indexes belonging to the captured analysis.
   *
   * Each index keeps independent selection and obligation state despite shared
   * semantic identities across configuration boundaries.
   */
  readonly populations: EvidQueryPopulationContext[];
}
