import type { IEvidenceGoDeclaration } from "./IEvidenceGoDeclaration";
import type { IEvidenceGoFileAnalysis } from "./IEvidenceGoFileAnalysis";

/**
 * Associates one physical Go declaration with its package-wide semantic unit.
 *
 * EvidenceGoPackageResolver uses this transient record to collect declaration
 * sites, resolve receiver ownership, and emit public addresses for the unit.
 */
export interface IEvidenceGoMaterializedDeclaration {
  /**
   * File analysis owning the declaration's physical source and package context.
   *
   * It supplies file paths and documentation during final materialization.
   */
  analysis: IEvidenceGoFileAnalysis;

  /**
   * Original scanner record contributing one site to the semantic unit.
   *
   * Receiver ownership may cause several records to share `unitId`.
   */
  declaration: IEvidenceGoDeclaration;

  /**
   * Package-wide semantic identity assigned after receiver resolution.
   *
   * This ID, rather than the scanner key, drives graph coverage counting.
   */
  unitId: string;
}
