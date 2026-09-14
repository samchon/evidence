import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ISqlDeclaration } from "./ISqlDeclaration";
import type { ISqlDocumentation } from "./ISqlDocumentation";

/** Node-free database extraction retained after a parse session closes. */
export interface ISqlFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: ISqlDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: ISqlDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
