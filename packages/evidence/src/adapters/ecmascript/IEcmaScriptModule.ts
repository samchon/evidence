import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEcmaScriptExport } from "./IEcmaScriptExport";
import type { IEcmaScriptImport } from "./IEcmaScriptImport";
import type { IEcmaScriptOwnedUnit } from "./IEcmaScriptOwnedUnit";

/** Resolver state for one parsed ECMAScript-family module. */
export interface IEcmaScriptModule {
  source: IEvidenceSourceFile;
  units: IEcmaScriptOwnedUnit[];
  excludedRoots: Set<string>;
  exports: IEcmaScriptExport[];
  imports: Map<string, IEcmaScriptImport>;
  names: Set<string>;
}
