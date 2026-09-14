import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IDbmlDeclaration } from "./IDbmlDeclaration";
import type { IDbmlDocumentation } from "./IDbmlDocumentation";
import type { IDbmlRelation } from "./IDbmlRelation";

/** Serializable per-file DBML syntax analysis. */
export interface IDbmlFileAnalysis {
  /** Source snapshot whose UTF-16 coordinates all ranges use. */
  source: IEvidenceSourceFile;
  /** Tables and columns established by syntax. */
  declarations: IDbmlDeclaration[];
  /** Relations pending cross-file endpoint resolution. */
  relations: IDbmlRelation[];
  /** Mapped comments and notes, including unsupported annotation carriers. */
  documentation: IDbmlDocumentation[];
  /** Enum semantic text retained in affected table fingerprints. */
  enums: string[];
  /** Actionable unsupported-syntax and parser failures. */
  diagnostics: IEvidenceDiagnostic[];
  /** Whether every selected declaration could be understood. */
  complete: boolean;
}
