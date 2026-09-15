import type { IEvidEcmaScriptBinding } from "./IEvidEcmaScriptBinding";

/**
 * Result of following one exported name through the static module graph.
 *
 * The export resolver caches this result for each source and name, then uses
 * its bindings to publish units and its state flags to distinguish exclusions
 * and declaration-free cycles from missing supported declarations.
 */
export interface IEvidEcmaScriptResolution {
  /**
   * Local declarations or namespace modules reached by the exported name.
   *
   * Multiple bindings can result from star exports; each carries the source and
   * type-space restriction needed during publication.
   */
  bindings: IEvidEcmaScriptBinding[];

  /**
   * Whether any resolution path reaches a deliberately excluded root.
   *
   * Exclusion suppresses a missing-declaration diagnostic and propagates
   * through local and re-export paths.
   */
  excluded: boolean;

  /**
   * Whether traversal encountered the same source-and-name pair recursively.
   *
   * A result with no bindings and this flag identifies a declaration-free
   * export cycle that must be reported instead of silently publishing nothing.
   */
  cyclic: boolean;
}
