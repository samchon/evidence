/**
 * Package metadata that can redirect a configuration dependency.
 *
 * ConfigDependencyScanner validates this narrow projection from fresh manifest
 * bytes on every watch cycle. Other package fields cannot select a runtime
 * entry or package scope and therefore remain outside the scanner's resolution
 * contract.
 */
export interface IConfigResolutionManifest {
  /**
   * Module interpretation applied to JavaScript files in this package scope.
   *
   * The exact value `module` makes `.js` and `.jsx` dependencies use ESM static
   * import conditions. Omission and every other value retain CommonJS.
   */
  type?: string;

  /**
   * Public package name used to recognize a self-reference.
   *
   * A matching bare request resolves against this manifest's exports without
   * requiring a duplicate copy under an ancestor `node_modules` directory.
   */
  name?: string;

  /**
   * Legacy root entry used when the package has no export map.
   *
   * Only a string selects a target. Omission and non-string JSON values use
   * Node's `index` fallback; subpath requests do not use this root field because
   * they already name their legacy path.
   */
  main?: unknown;

  /**
   * Conditional or subpath export map controlling public package requests.
   *
   * Omission enables legacy `main` and direct-subpath lookup. Presence makes
   * unexported or condition-incompatible requests explicit resolution failures.
   */
  exports?: unknown;

  /**
   * Internal `#` specifier map owned by this package scope.
   *
   * Values retain their authored shape until the scanner applies exact or
   * pattern matching and the active import/require conditions.
   */
  imports?: unknown;
}
