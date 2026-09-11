import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IPythonAll } from "./IPythonAll";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonOwnedUnit } from "./IPythonOwnedUnit";

/** One Python source module prepared for export traversal. */
export interface IPythonModule {
  source: IEvidenceSourceFile;
  all: IPythonAll;
  bindings: IPythonBinding[];
  units: IPythonOwnedUnit[];
  names: Set<string>;
}
