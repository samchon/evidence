import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";
import type { IRustUse } from "./IRustUse";

/**
 * Represents one inline or file-backed module in the selected crate graph.
 *
 * The resolver uses module records as the scope for direct bindings, use
 * declarations, and paths that lead to externally reachable declarations.
 */
export interface IRustModuleRecord {
  /**
   * Stable serialized key combining the crate root and resolved module path.
   *
   * Internal maps use this key so same-named modules in different crates remain
   * separate.
   */
  key: string;

  /**
   * Stable key identifying the crate that owns this module.
   *
   * Unit identities include this value to prevent cross-crate collisions.
   */
  rootKey: string;

  /**
   * Canonical module segments from the crate root to this module.
   *
   * Resolver path operations use this for `crate`, `self`, and `super` lookup.
   */
  path: string[];

  /**
   * Module segments relative to the placed file that supplied this record.
   *
   * The value lets the resolver find an inline module declaration in its source
   * analysis.
   */
  localPath: string[];

  /**
   * File placement that provides this module's direct declarations.
   *
   * Reexport records carry this placement to retain a valid address carrier.
   */
  placement: IRustFilePlacement;

  /**
   * Declaration that introduced this module, when it is not a crate root.
   *
   * Omission identifies the synthetic root module for a selected crate file.
   */
  declaration?: IRustDeclaration;

  /**
   * Direct declarations grouped by their local Rust name.
   *
   * Multiple values preserve ambiguities so resolution can report them rather
   * than choosing an arbitrary public target.
   */
  bindings: Map<string, IRustDeclaration[]>;

  /**
   * Public use declarations written in this module.
   *
   * Export construction expands these after direct module bindings exist.
   */
  uses: IRustUse[];
}
