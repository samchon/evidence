import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ICSharpDeclaration } from "./ICSharpDeclaration";
import type { ICSharpDocumentation } from "./ICSharpDocumentation";

/** Node-free C# extraction retained after a parse session closes. */
export interface ICSharpFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: ICSharpDeclaration[];
  documentation: ICSharpDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
