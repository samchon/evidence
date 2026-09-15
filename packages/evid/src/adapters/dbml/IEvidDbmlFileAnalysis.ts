import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidDbmlDeclaration } from "./IEvidDbmlDeclaration";
import type { IEvidDbmlDocumentation } from "./IEvidDbmlDocumentation";
import type { IEvidDbmlEnum } from "./IEvidDbmlEnum";
import type { IEvidDbmlRelation } from "./IEvidDbmlRelation";

/**
 * Captures all DBML facts extracted from one source file.
 *
 * The adapter combines these serializable results after scanning every selected
 * file, when cross-file relations and enum dependencies can resolve.
 */
export interface IEvidDbmlFileAnalysis {
  /**
   * Provides the source snapshot that owns every range in this analysis.
   *
   * All ranges use this snapshot's UTF-16 offsets rather than normalized positions.
   */
  source: IEvidSourceFile;

  /**
   * Lists table and column declarations established directly by DBML syntax.
   *
   * These declarations become candidates for later Evid unit materialization.
   */
  declarations: IEvidDbmlDeclaration[];

  /**
   * Lists relations whose endpoints still need selected-schema resolution.
   *
   * A relation may refer to declarations owned by another scanned file.
   */
  relations: IEvidDbmlRelation[];

  /**
   * Retains mapped comments and notes, including unsupported attachment carriers.
   *
   * Later parsing can emit precise diagnostics instead of silently dropping annotations.
   */
  documentation: IEvidDbmlDocumentation[];

  /**
   * Lists enum semantics required by affected table fingerprints.
   *
   * The adapter applies these nonselectable dependencies to referring declarations.
   */
  enums: IEvidDbmlEnum[];

  /**
   * Records actionable parser failures and unsupported syntax.
   *
   * Consumers report these diagnostics before treating the file as complete.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether scanning understood every selected declaration.
   *
   * `false` prevents unsupported syntax from shrinking the coverage population.
   */
  complete: boolean;
}
