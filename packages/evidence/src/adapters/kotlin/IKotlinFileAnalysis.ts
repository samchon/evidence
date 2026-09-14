import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IKotlinDeclaration } from "./IKotlinDeclaration";
import type { IKotlinDocumentation } from "./IKotlinDocumentation";

/** Node-free Kotlin extraction retained after a parse session closes. */
export interface IKotlinFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IKotlinDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IKotlinDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
