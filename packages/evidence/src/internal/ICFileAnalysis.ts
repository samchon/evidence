import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ICDeclaration } from "./ICDeclaration";
import type { ICDocumentation } from "./ICDocumentation";

/** Node-free C extraction retained after a parse session closes. */
export interface ICFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: ICDeclaration[];
  documentation: ICDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
