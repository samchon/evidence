import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IGoDeclaration } from "./IGoDeclaration";
import type { IGoDocumentation } from "./IGoDocumentation";

/** Node-free Go extraction retained after a parse session closes. */
export interface IGoFileAnalysis {
  source: IEvidenceSourceFile;
  directory: string;
  packageName?: string;
  testFile: boolean;
  declarations: IGoDeclaration[];
  documentation: IGoDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
