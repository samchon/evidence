import type { IEvidGoDeclaration } from "./IEvidGoDeclaration";
import type { IEvidGoFileAnalysis } from "./IEvidGoFileAnalysis";

/**
 * Associates one physical Go declaration with its package-wide semantic unit.
 *
 * EvidGoPackageResolver uses this transient record to collect declaration
 * sites, resolve receiver ownership, and emit public addresses for the unit.
 */
export interface IEvidGoMaterializedDeclaration {
  /**
   * File analysis owning the declaration's physical source and package context.
   *
   * It supplies file paths and documentation during final materialization.
   */
  analysis: IEvidGoFileAnalysis;

  /**
   * Original scanner record contributing one site to the semantic unit.
   *
   * Receiver ownership may cause several records to share `unitId`.
   */
  declaration: IEvidGoDeclaration;

  /**
   * Package-wide semantic identity assigned after receiver resolution.
   *
   * This ID, rather than the scanner key, drives graph coverage counting.
   */
  unitId: string;
}
