import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ITypeScriptComment } from "./ITypeScriptComment";
import type { ITypeScriptExport } from "./ITypeScriptExport";
import type { ITypeScriptImport } from "./ITypeScriptImport";
import type { ITypeScriptHostPosition } from "./ITypeScriptHostPosition";
import type { ITypeScriptOwnedUnit } from "./ITypeScriptOwnedUnit";

/** Node-free TypeScript extraction retained after a borrowed parse session closes. */
export interface ITypeScriptFileAnalysis {
  source: IEvidenceSourceFile;
  units: ITypeScriptOwnedUnit[];
  excludedRoots: string[];
  exports: ITypeScriptExport[];
  imports: ITypeScriptImport[];
  positions: ITypeScriptHostPosition[];
  comments: ITypeScriptComment[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
