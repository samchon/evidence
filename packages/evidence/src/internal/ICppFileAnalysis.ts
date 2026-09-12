import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ICppAlias } from "./ICppAlias";
import type { ICppDeclaration } from "./ICppDeclaration";
import type { ICppDocumentation } from "./ICppDocumentation";

/** Node-free C++ extraction retained after a parse session closes. */
export interface ICppFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: ICppDeclaration[];
  aliases: ICppAlias[];
  documentation: ICppDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
