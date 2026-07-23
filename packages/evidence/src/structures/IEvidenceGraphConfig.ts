import type { IEvidenceGraphSource } from "./IEvidenceGraphSource";

/**
 * The root declaration of a project's evidence graph.
 *
 * An evidence graph makes grounds for code and documentation explicit: one side
 * supplies evidence units and the other side must acknowledge them with a
 * reason. The configuration defines those boundaries without hardcoding a
 * repository's folder layout or its notion of proof.
 */
export interface IEvidenceGraphConfig {
  /**
   * Source groups that contribute evidence units to this project's graph. Each
   * source owns its reference obligations; coverage is never pooled across
   * sources. Provide at least one source; an empty array is invalid because it
   * would enable the rule without establishing any evidence obligation.
   */
  sources: IEvidenceGraphSource[];
}
