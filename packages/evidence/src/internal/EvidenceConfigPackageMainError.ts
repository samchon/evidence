/**
 * Marks an explicit CommonJS package main that exhausted its runtime fallbacks.
 *
 * A missing default index permits CommonJS lookup to try the next
 * `node_modules` root. Once a manifest explicitly selects `main`, Node instead
 * reports that package as broken after its own index fallback also fails.
 */
export class EvidenceConfigPackageMainError extends Error {
  /**
   * Creates an authoritative failure for one explicit legacy `main` target.
   *
   * The original resolution cause remains available to diagnostics while this
   * error type prevents ancestor `node_modules` fallback from hiding the broken
   * package selected at the current search root.
   */
  public constructor(directory: string, target: string, cause: unknown) {
    super(
      `Package '${directory}' declares an unusable main target '${target}'.`,
      { cause },
    );
    this.name = "EvidenceConfigPackageMainError";
  }
}
