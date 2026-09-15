import type { IEvidenceRustExportRecord } from "./IEvidenceRustExportRecord";
import type { IEvidenceRustFilePlacement } from "./IEvidenceRustFilePlacement";
import type { IEvidenceRustLocatedDeclaration } from "./IEvidenceRustLocatedDeclaration";

/**
 * Records one public path through which a selected Rust declaration is
 * reachable.
 *
 * Materialization turns each occurrence into addresses while keeping the
 * declaration's semantic identity independent of aliases and reexports.
 */
export interface IEvidenceRustPublicOccurrence {
  /**
   * Resolved declaration reached through the public path.
   *
   * This supplies the unit identity and source site for materialization.
   */
  located: IEvidenceRustLocatedDeclaration;

  /**
   * Export edge that introduced the final path segment.
   *
   * Its carrier identifies the source context that can address the alias.
   */
  exported: IEvidenceRustExportRecord;

  /**
   * File placement carrying the namespace used to traverse the path.
   *
   * This can differ from the declaration's source file after a reexport.
   */
  namespaceCarrier: IEvidenceRustFilePlacement;

  /**
   * Crate-relative public accessor segments for this occurrence.
   *
   * Each alias contributes a separate path without duplicating the evidence
   * unit.
   */
  publicPath: string[];
}
