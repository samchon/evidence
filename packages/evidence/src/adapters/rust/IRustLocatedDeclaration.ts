import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";
import type { IRustModuleRecord } from "./IRustModuleRecord";

/**
 * Locates one Rust declaration in the resolved selected crate graph.
 *
 * Resolver phases enrich scanner output with module placement and a semantic
 * identity before materializing units and public addresses.
 */
export interface IRustLocatedDeclaration {
  /**
   * Scanner record describing the declaration's syntax and local ownership.
   *
   * Its source site remains the provenance for the resulting Evidence unit.
   */
  declaration: IRustDeclaration;

  /**
   * Selected file and crate prefix containing the declaration.
   *
   * Address publication uses this placement to preserve file-qualified targets.
   */
  placement: IRustFilePlacement;

  /**
   * Resolved module that owns the declaration.
   *
   * Binding and export resolution start from this record.
   */
  module: IRustModuleRecord;

  /**
   * Canonical crate-relative segments naming the declaration semantically.
   *
   * Reexports may add public paths without changing this identity.
   */
  identity: string[];
}
