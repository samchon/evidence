/**
 * Executable mapping from the consumer-installed `ttsc` package manifest.
 *
 * The isolated configuration evaluator reads this projection through
 * `IEvidenceTtsxManifest` so it can invoke the consumer's compiler launcher instead
 * of resolving a tool from Evidence's own dependency graph.
 */
export interface IEvidenceTtsxExecutables {
  /**
   * Relative path to the `ttsx` launcher within the installed `ttsc` package.
   *
   * The evaluator resolves this path against the manifest directory before it
   * starts the temporary project that evaluates the user's configuration.
   */
  ttsx: string;
}
