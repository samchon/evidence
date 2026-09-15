import type { IEvidGraphHostCoverage } from "./IEvidGraphHostCoverage";
import type { IEvidGraphPolicy } from "./IEvidGraphPolicy";
import type { IEvidQueryScope } from "./IEvidQueryScope";

/**
 * Exported policy and coverage ledger for one independent claim/reference pair.
 *
 * All related nodes, acknowledgement edges, and reviews identify this boundary.
 * Selected unit IDs establish its denominator; checklist mode additionally keeps
 * each claim host's answer ledger so answers cannot be pooled between hosts.
 */
export interface IEvidGraphBoundary {
  /**
   * Export identity derived from authored claim and reference indices.
   *
   * Related nodes and relationships use this key to retain obligation ownership.
   */
  id: string;

  /**
   * Configured population supplying semantic claim hosts.
   *
   * Its role, artifact type, and authored index describe the citing side of the pair.
   */
  claim: IEvidQueryScope;

  /**
   * Configured population supplying required evidence units.
   *
   * Its reference index distinguishes repeated requirements under the same claim.
   */
  reference: IEvidQueryScope;

  /**
   * Effective acknowledgement, exclusion, and review rules for the pair.
   *
   * Inherited settings have been resolved into the booleans and severity used by evaluation.
   */
  policy: IEvidGraphPolicy;

  /**
   * Whether the pair participates in graph coverage evaluation.
   *
   * Inactive boundaries retain context without contributing active requirements.
   */
  active: boolean;

  /**
   * Whether the obligation's analysis established complete population data.
   *
   * False prevents interpreting apparent coverage as a trustworthy pass.
   */
  complete: boolean;

  /**
   * Selected semantic reference identities forming this boundary's denominator.
   *
   * Structural ancestors may appear as nodes without being added to this list.
   */
  unitIds: string[];

  /**
   * Selected reference identities covered under this boundary's policy.
   *
   * The same identity may remain missing in another independent boundary.
   */
  coveredUnitIds: string[];

  /**
   * Selected reference identities still lacking required acknowledgement.
   *
   * These retain the obligation's uncovered requirements rather than unresolved names.
   */
  missingUnitIds: string[];

  /**
   * Per-host answer ledgers when this obligation uses Markdown checklist mode.
   *
   * Ordinary coverage leaves the array empty; checklist answers remain attributable
   * to each semantic claim subject.
   */
  hostCoverage: IEvidGraphHostCoverage[];
}
