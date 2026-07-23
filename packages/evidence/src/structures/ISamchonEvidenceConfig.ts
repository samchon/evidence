import type { TtscLintSeverity } from "@ttsc/lint";
import type { ISamchonEvidenceSource } from "./ISamchonEvidenceSource";

/**
 * The root declaration of a project's evidence graph.
 *
 * An evidence graph makes grounds for code and documentation explicit: one side
 * supplies evidence units and the other side must acknowledge them with a
 * reason. The configuration defines those boundaries without hardcoding a
 * repository's folder layout or its notion of proof.
 */
export interface ISamchonEvidenceConfig {
  /**
   * Default severity for every evidence source.
   *
   * @default error
   */
  severity?: TtscLintSeverity;

  /**
   * Source groups that contribute evidence units to this project's graph. Each
   * source owns its reference obligations; coverage is never pooled across
   * sources.
   */
  sources: ISamchonEvidenceSource[];
}
