import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPhpDeclaration } from "./IPhpDeclaration";
import type { IPhpDocumentation } from "./IPhpDocumentation";

/** Node-free PHP extraction retained after a parse session closes. */
export interface IPhpFileAnalysis {
  /** Selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations before materialization. */
  declarations: IPhpDeclaration[];

  /** PHPDoc carriers and their attachment decisions. */
  documentation: IPhpDocumentation[];

  /** Source or extraction failures. */
  diagnostics: IEvidenceDiagnostic[];

  /** File-local imports and execution directives that affect declaration meaning. */
  context: string[];

  /** Whether extraction classified the whole declared surface. */
  complete: boolean;
}
