import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceDependency } from "../../structures/IEvidenceSourceDependency";
import type { EcmaScriptModuleMode } from "./EcmaScriptModuleMode";

/** Module modes and filesystem evidence needed by ECMAScript-family analysis. */
export interface IEcmaScriptModuleResolution {
  modes: Map<string, EcmaScriptModuleMode>;
  dependencies: IEvidenceSourceDependency[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
