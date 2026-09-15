/**
 * Executable mapping from the consumer-installed `ttsc` package manifest.
 *
 * The isolated configuration evaluator reads this projection through
 * `IEvidTtsxManifest` so it can invoke the consumer's compiler launcher instead of
 * resolving a tool from Evid's own dependency graph.
 */
export interface IEvidTtsxExecutables {
  /**
   * Relative path to the `ttsx` launcher within the installed `ttsc` package.
   *
   * The evaluator resolves this path against the manifest directory before it
   * starts the temporary project that evaluates the user's configuration.
   */
  ttsx: string;
}
