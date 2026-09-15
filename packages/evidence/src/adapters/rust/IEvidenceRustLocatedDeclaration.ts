import type { IEvidenceRustDeclaration } from "./IEvidenceRustDeclaration";
import type { IEvidenceRustFilePlacement } from "./IEvidenceRustFilePlacement";
import type { IEvidenceRustModuleRecord } from "./IEvidenceRustModuleRecord";

/**
 * Locates one Rust declaration in the resolved selected crate graph.
 *
 * Resolver phases enrich scanner output with module placement and a semantic
 * identity before materializing units and public addresses.
 */
export interface IEvidenceRustLocatedDeclaration {
  /**
   * Scanner record describing the declaration's syntax and local ownership.
   *
   * Its source site remains the provenance for the resulting evidence unit.
   */
  declaration: IEvidenceRustDeclaration;

  /**
   * Selected file and crate prefix containing the declaration.
   *
   * Address publication uses this placement to preserve file-qualified targets.
   */
  placement: IEvidenceRustFilePlacement;

  /**
   * Resolved module that owns the declaration.
   *
   * Binding and export resolution start from this record.
   */
  module: IEvidenceRustModuleRecord;

  /**
   * Canonical crate-relative segments naming the declaration semantically.
   *
   * Reexports may add public paths without changing this identity.
   */
  identity: string[];
}
