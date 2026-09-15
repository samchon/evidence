import type { IEvidPythonResolvedBinding } from "./IEvidPythonResolvedBinding";

/**
 * Represents the bounded static result of one Python name lookup.
 *
 * The resolver distinguishes reachable bindings from a cyclic path so callers
 * can retain an incomplete diagnostic instead of treating recursion as absence.
 */
export interface IEvidPythonResolution {
  /**
   * Declaration roots or namespaces reached by the requested name.
   *
   * Multiple entries preserve aliases and star-import alternatives until publication deduplicates units.
   */
  bindings: IEvidPythonResolvedBinding[];

  /**
   * Whether resolving this lookup encountered an active import cycle.
   *
   * A cycle prevents the resolver from certifying that omitted exports are private.
   */
  cyclic: boolean;
}
