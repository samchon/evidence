import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ITypeScriptExport } from "./ITypeScriptExport";
import type { ITypeScriptImport } from "./ITypeScriptImport";
import type { ITypeScriptOwnedUnit } from "./ITypeScriptOwnedUnit";

/** Resolver state for one parsed TypeScript source module. */
export interface ITypeScriptModule {
  source: IEvidenceSourceFile;
  units: ITypeScriptOwnedUnit[];
  excludedRoots: Set<string>;
  exports: ITypeScriptExport[];
  imports: Map<string, ITypeScriptImport>;
  names: Set<string>;
}
