import type { ITtsxExecutables } from "./ITtsxExecutables";

/**
 * Consumer-installed `ttsc` manifest fields required for isolated configuration evaluation.
 *
 * `evaluateTypeScriptConfig` validates this narrow manifest projection after
 * resolving `ttsc` from the config's dependency graph, then uses its executable
 * mapping to start the matching `ttsx` launcher.
 */
export interface ITtsxManifest {
  /**
   * Declared executable names and relative paths from the installed package.
   *
   * The evaluator consumes the `ttsx` entry in this mapping through
   * `ITtsxExecutables`; no other package manifest fields affect the launch.
   */
  bin: ITtsxExecutables;
}
