import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IObjcDeclaration } from "./IObjcDeclaration";
import type { IObjcDocumentation } from "./IObjcDocumentation";

/** Node-free Objc extraction retained after a parse session closes. */
export interface IObjcFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: IObjcDeclaration[];
  documentation: IObjcDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
