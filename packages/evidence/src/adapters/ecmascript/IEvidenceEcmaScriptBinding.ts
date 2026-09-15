/**
 * Resolves one public ECMAScript export to a local declaration or module
 * namespace.
 *
 * The export resolver carries this intermediate record across local exports and
 * re-export paths before it publishes public addresses for owned units.
 */
export interface IEvidenceEcmaScriptBinding {
  /**
   * Identifier of the source file that owns the resolved binding.
   *
   * A namespace binding names this module even when it has no individual local
   * declaration name, allowing the resolver to traverse its public exports.
   */
  sourceId: string;

  /**
   * Local root name of the declaration within {@link sourceId}.
   *
   * Omission represents a namespace binding, whose reachable exports must be
   * expanded before an owned unit can be published.
   */
  localName?: string;

  /**
   * Whether the export path is restricted to TypeScript's type space.
   *
   * The resolver retains this restriction through re-exports and excludes
   * value-only units when it publishes the final public addresses.
   */
  typeOnly: boolean;
}
