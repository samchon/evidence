/**
 * Package metadata consulted when JavaScript files lack an explicit mode
 * extension.
 *
 * `EvidenceEcmaScriptModuleResolver` parses the nearest `package.json` and uses
 * this narrow contract to select CommonJS or ESM semantics for ordinary
 * JavaScript source files.
 */
export interface IEvidenceJavaScriptPackageJson {
  /**
   * Package-wide JavaScript module interpretation requested by the author.
   *
   * Omission and `"commonjs"` select CommonJS, `"module"` selects ESM, and any
   * other value produces a diagnostic before the resolver falls back to
   * CommonJS.
   */
  type?: string;
}
