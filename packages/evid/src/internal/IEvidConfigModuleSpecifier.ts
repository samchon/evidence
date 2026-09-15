import type { EvidConfigModuleMode } from "./EvidConfigModuleMode";

/**
 * Statically discoverable configuration dependency before filesystem resolution.
 *
 * EvidConfigDependencyScanner retains the loading mechanism beside the authored
 * specifier because conditional package exports can map the same text to
 * different physical files.
 */
export interface IEvidConfigModuleSpecifier {
  /**
   * Authored module specifier without its string-literal delimiters.
   *
   * Relative, file URL, package, and built-in forms remain intact until the
   * resolver applies the same category boundary used during evaluation.
   */
  specifier: string;

  /**
   * Loading mechanism that selects package export conditions.
   *
   * Static imports inherit the evaluator's module kind. Literal `import()` and
   * `require()` calls retain their own mechanism independently.
   */
  mode: EvidConfigModuleMode;
}
