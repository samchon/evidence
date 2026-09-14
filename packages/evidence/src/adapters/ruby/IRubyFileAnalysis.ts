import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IRubyDeclaration } from "./IRubyDeclaration";
import type { IRubyDocumentation } from "./IRubyDocumentation";

/** Node-free Ruby extraction retained after its parse session closes. */
export interface IRubyFileAnalysis {
  source: IEvidenceSourceFile;
  declarations: IRubyDeclaration[];
  documentation: IRubyDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
