import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ILuaDeclaration } from "./ILuaDeclaration";
import type { ILuaDocumentation } from "./ILuaDocumentation";

/** Node-free Lua extraction retained after a parse session closes. */
export interface ILuaFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: ILuaDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: ILuaDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
