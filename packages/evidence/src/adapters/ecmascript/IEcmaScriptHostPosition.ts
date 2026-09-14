import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/**
 * Represents one physical declaration position eligible to host JSDoc evidence.
 *
 * The adapter emits the position as an undocumented host unless an attached,
 * public comment replaces its range with a documented claim.
 */
export interface IEcmaScriptHostPosition {
  /** Stable physical-position key used to deduplicate documented and empty hosts.
   *
   * It does not substitute for a semantic unit identity. */
  id: string;

  /** Declaration site associated with this host position.
   *
   * The site connects annotations to fingerprinted source ownership. */
  siteId: string;

  /** Exact range emitted for an undocumented eligible host.
   *
   * A documented comment replaces this position as the host's range. */
  range: IEvidenceSourceRange;

  /** Selected local units that legitimately share this declaration position.
   *
   * The adapter filters it by export reachability before publication. */
  unitIds: string[];
}
