import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EcmaScriptModuleMode } from "./EcmaScriptModuleMode";
import type { IEcmaScriptComment } from "./IEcmaScriptComment";
import type { IEcmaScriptExport } from "./IEcmaScriptExport";
import type { IEcmaScriptImport } from "./IEcmaScriptImport";
import type { IEcmaScriptHostPosition } from "./IEcmaScriptHostPosition";
import type { IEcmaScriptOwnedUnit } from "./IEcmaScriptOwnedUnit";

/** Node-free ECMAScript-family extraction retained after a parse session closes. */
export interface IEcmaScriptFileAnalysis {
  source: IEvidenceSourceFile;
  mode: EcmaScriptModuleMode;
  units: IEcmaScriptOwnedUnit[];
  excludedRoots: string[];
  exports: IEcmaScriptExport[];
  imports: IEcmaScriptImport[];
  positions: IEcmaScriptHostPosition[];
  comments: IEcmaScriptComment[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
