import type { IScalaExport } from "./IScalaExport";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IScalaDeclaration } from "./IScalaDeclaration";
import type { IScalaDocumentation } from "./IScalaDocumentation";

/** Node-free Scala extraction retained after a parse session closes. */
export interface IScalaFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IScalaDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IScalaDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Explicit exports awaiting selected-source resolution. */
  exports: IScalaExport[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
