import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPythonAll } from "./IPythonAll";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonDocumentation } from "./IPythonDocumentation";
import type { IPythonHostPosition } from "./IPythonHostPosition";
import type { IPythonOwnedUnit } from "./IPythonOwnedUnit";

/** Node-free Python extraction retained after a parse session closes. */
export interface IPythonFileAnalysis {
  source: IEvidenceSourceFile;
  all: IPythonAll;
  bindings: IPythonBinding[];
  units: IPythonOwnedUnit[];
  positions: IPythonHostPosition[];
  documentation: IPythonDocumentation[];
  diagnostics: IEvidenceDiagnostic[];
  complete: boolean;
}
