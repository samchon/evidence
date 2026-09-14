import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ISwiftDeclaration } from "./ISwiftDeclaration";
import type { ISwiftDocumentation } from "./ISwiftDocumentation";

/** Node-free Swift extraction retained after a parse session closes. */
export interface ISwiftFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: ISwiftDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: ISwiftDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
