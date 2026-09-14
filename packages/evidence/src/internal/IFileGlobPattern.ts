/**
 * One normalized include or exclusion rule in the ordered Evidence glob program.
 *
 * `FileGlob` creates these records while compiling configured file patterns,
 * then applies them in order to determine a path's current inclusion decision.
 */
export interface IFileGlobPattern {
  /**
   * Portable relative path segments interpreted by the limited glob matcher.
   *
   * Compilation removes the exclusion marker and normalizes separators before
   * storing these tokens, so matching never depends on host path separators.
   */
  segments: string[];

  /**
   * Whether a matching rule clears the current inclusion decision.
   *
   * This is true for patterns authored with `!`; a later positive rule can
   * restore a path because `FileGlob` evaluates every rule in declaration order.
   */
  exclude: boolean;
}
