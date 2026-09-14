import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IMatlabDeclaration } from "./IMatlabDeclaration";
import type { IMatlabDocumentation } from "./IMatlabDocumentation";

/** Node-free Matlab extraction retained after a parse session closes. */
export interface IMatlabFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IMatlabDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IMatlabDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
