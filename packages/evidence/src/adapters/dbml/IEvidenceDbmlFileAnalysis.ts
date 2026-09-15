import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceDbmlDeclaration } from "./IEvidenceDbmlDeclaration";
import type { IEvidenceDbmlDocumentation } from "./IEvidenceDbmlDocumentation";
import type { IEvidenceDbmlEnum } from "./IEvidenceDbmlEnum";
import type { IEvidenceDbmlRelation } from "./IEvidenceDbmlRelation";

/**
 * Captures all DBML facts extracted from one source file.
 *
 * The adapter combines these serializable results after scanning every selected
 * file, when cross-file relations and enum dependencies can resolve.
 */
export interface IEvidenceDbmlFileAnalysis {
  /**
   * Provides the source snapshot that owns every range in this analysis.
   *
   * All ranges use this snapshot's UTF-16 offsets rather than normalized
   * positions.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists table and column declarations established directly by DBML syntax.
   *
   * These declarations become candidates for later Evidence unit materialization.
   */
  declarations: IEvidenceDbmlDeclaration[];

  /**
   * Lists relations whose endpoints still need selected-schema resolution.
   *
   * A relation may refer to declarations owned by another scanned file.
   */
  relations: IEvidenceDbmlRelation[];

  /**
   * Retains mapped comments and notes, including unsupported attachment
   * carriers.
   *
   * Later parsing can emit precise diagnostics instead of silently dropping
   * annotations.
   */
  documentation: IEvidenceDbmlDocumentation[];

  /**
   * Lists enum semantics required by affected table fingerprints.
   *
   * The adapter applies these nonselectable dependencies to referring
   * declarations.
   */
  enums: IEvidenceDbmlEnum[];

  /**
   * Records actionable parser failures and unsupported syntax.
   *
   * Consumers report these diagnostics before treating the file as complete.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether scanning understood every selected declaration.
   *
   * `false` prevents unsupported syntax from shrinking the coverage population.
   */
  complete: boolean;
}
