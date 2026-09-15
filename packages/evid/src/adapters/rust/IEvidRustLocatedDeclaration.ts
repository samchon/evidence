import type { IEvidRustDeclaration } from "./IEvidRustDeclaration";
import type { IEvidRustFilePlacement } from "./IEvidRustFilePlacement";
import type { IEvidRustModuleRecord } from "./IEvidRustModuleRecord";

/**
 * Locates one Rust declaration in the resolved selected crate graph.
 *
 * Resolver phases enrich scanner output with module placement and a semantic
 * identity before materializing units and public addresses.
 */
export interface IEvidRustLocatedDeclaration {
  /**
   * Scanner record describing the declaration's syntax and local ownership.
   *
   * Its source site remains the provenance for the resulting Evid unit.
   */
  declaration: IEvidRustDeclaration;

  /**
   * Selected file and crate prefix containing the declaration.
   *
   * Address publication uses this placement to preserve file-qualified targets.
   */
  placement: IEvidRustFilePlacement;

  /**
   * Resolved module that owns the declaration.
   *
   * Binding and export resolution start from this record.
   */
  module: IEvidRustModuleRecord;

  /**
   * Canonical crate-relative segments naming the declaration semantically.
   *
   * Reexports may add public paths without changing this identity.
   */
  identity: string[];
}
