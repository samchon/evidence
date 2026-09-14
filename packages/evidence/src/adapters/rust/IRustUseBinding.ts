/**
 * Describes one statically spelled target within a public Rust use declaration.
 *
 * Use-tree expansion preserves each leaf separately so aliases and wildcard
 * exports receive their Rust-specific resolution rules.
 */
export interface IRustUseBinding {
  /**
   * Source path segments from the use declaration to the imported target.
   *
   * The resolver interprets crate, self, and super segments in the use module.
   */
  path: string[];

  /**
   * Public name assigned with `as`, when the binding renames its target.
   *
   * Omission publishes the target's final path segment.
   */
  alias?: string;

  /**
   * Whether this binding reexports all public names from its target module.
   *
   * A false value identifies one named import path.
   */
  wildcard: boolean;
}
