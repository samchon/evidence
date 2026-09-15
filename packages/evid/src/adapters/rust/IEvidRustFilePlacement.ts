import type { IEvidRustFileAnalysis } from "./IEvidRustFileAnalysis";

/**
 * Assigns a selected Rust file to one crate root and module prefix.
 *
 * EvidRustModuleResolver creates placements before building module records, so
 * the same scan result can be addressed in the crate namespace and source
 * files.
 */
export interface IEvidRustFilePlacement {
  /**
   * EvidNode-free scan result for the selected file.
   *
   * This record owns declarations and diagnostics associated with the
   * placement.
   */
  analysis: IEvidRustFileAnalysis;

  /**
   * Stable key for the crate root that contains the file.
   *
   * Module and unit keys include it to keep identical paths in separate crates
   * distinct.
   */
  rootKey: string;

  /**
   * Module segments prepended to declarations scanned from the file.
   *
   * An empty prefix identifies a crate root file.
   */
  prefix: string[];

  /**
   * Declaration ID of the external module that selected this file, when any.
   *
   * Omission marks a root file or an inline-module context without an external
   * declaration to attach.
   */
  moduleDeclarationId?: string;
}
