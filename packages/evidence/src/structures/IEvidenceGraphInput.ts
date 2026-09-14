import type { IEvidenceGraphClaim } from "./IEvidenceGraphClaim";

/**
 * Materialized populations and resolutions ready for graph policy evaluation.
 *
 * The checker has already loaded sources, extracted inventories, and resolved
 * targets. `EvidenceGraph` consumes this record without source IO. Direct callers
 * must provide consistent identity and ownership records; a resolved status alone
 * cannot grant coverage to a unit absent from its reference inventory.
 *
 * @example
 * // There are no obligations to evaluate until a materialized claim is supplied.
 * const input: IEvidenceGraphInput = { claims: [] };
 * const result: IEvidenceGraphResult = EvidenceGraph.evaluate(input);
 * // result.success is true and result.claims is empty.
 */
export interface IEvidenceGraphInput {
  /**
   * Claim populations with independently configured reference obligations.
   *
   * Preserve repeated claims and references rather than merging equal file sets.
   * An empty direct graph input has no obligations and evaluates successfully.
   */
  claims: IEvidenceGraphClaim[];
}
