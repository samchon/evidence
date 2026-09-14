import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IZigDeclaration } from "./IZigDeclaration";
import type { IZigDocumentation } from "./IZigDocumentation";

/** Node-free Zig extraction retained after a parse session closes. */
export interface IZigFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IZigDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IZigDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
