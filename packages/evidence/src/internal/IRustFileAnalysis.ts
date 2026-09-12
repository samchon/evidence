import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustDocumentation } from "./IRustDocumentation";
import type { IRustExternalModule } from "./IRustExternalModule";
import type { IRustImplementation } from "./IRustImplementation";
import type { IRustUse } from "./IRustUse";

/** Node-free Rust extraction retained after a parse session closes. */
export interface IRustFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: IRustDeclaration[];
  documentation: IRustDocumentation[];
  externalModules: IRustExternalModule[];
  implementations: IRustImplementation[];
  uses: IRustUse[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
