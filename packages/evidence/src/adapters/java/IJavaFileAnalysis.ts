import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IJavaDeclaration } from "./IJavaDeclaration";
import type { IJavaDocumentation } from "./IJavaDocumentation";

/** Node-free Java extraction retained after a parse session closes. */
export interface IJavaFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: IJavaDeclaration[];
  documentation: IJavaDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
