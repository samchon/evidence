import type { EvidSeverity } from "../typings/EvidSeverity";

/**
 * Effective policy exposed for one independent claim/reference obligation.
 *
 * Queries and graph exports use this shape after optional settings have been
 * resolved to explicit values. It explains why a statement contributes coverage
 * in this boundary, or why another reference over the same units can reject it.
 * The policy does not modify shared semantic identity or source inventories.
 */
export interface IEvidGraphPolicy {
  /**
   * Diagnostic severity of this obligation.
   *
   * Off denotes an inactive boundary. Active levels attribute findings to the
   * reference after configuration inheritance has been resolved.
   */
  severity: EvidSeverity;

  /**
   * Whether exclusions are refused instead of acknowledged.
   *
   * Refusal is local to this reference and leaves positive evidence outstanding
   * for its targets, even when another obligation accepts the same exclusion.
   */
  noEvidExclude: boolean;

  /**
   * Whether a selected target can have at most one positive semantic host.
   *
   * Repeated tags and overload positions count through semantic ownership.
   * Exclusions do not provide positive host ownership.
   */
  uniqueEvid: boolean;

  /**
   * Whether each selected claim host must cite exactly one selected unit.
   *
   * Untagged hosts count as zero. Aggregate citations count each selected
   * descendant they acknowledge rather than counting as one target token.
   */
  singleEvidPerSymbol: boolean;

  /**
   * Whether every host must independently answer every Markdown item.
   *
   * Positive evidence answers the named item only. Permitted exclusions can
   * cascade within that host's scope without answering for other hosts.
   */
  checklist: boolean;

  /**
   * Whether acknowledgements need paired reviews with current fingerprints.
   *
   * Reviews match semantic host, resolved target, and acknowledgement kind.
   * They validate coverage statements but never supply coverage themselves.
   */
  requireReview: boolean;
}
