import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPhpDeclaration } from "./IPhpDeclaration";
import type { IPhpDocumentation } from "./IPhpDocumentation";

/** Node-free Php extraction retained after a parse session closes. */
export interface IPhpFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: IPhpDeclaration[];
  documentation: IPhpDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
