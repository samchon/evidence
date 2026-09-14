import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IDartDirective } from "./IDartDirective";
import type { IDartDeclaration } from "./IDartDeclaration";
import type { IDartDocumentation } from "./IDartDocumentation";

/** Node-free Dart extraction retained after a parse session closes. */
export interface IDartFileAnalysis {
  /** Selected defining library physical path. */
  library: string;

  /** Optional named library declaration or part-of name. */
  libraryName?: string;

  /** Library topology directives retained for snapshot resolution. */
  directives: IDartDirective[];

  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Extracted declarations, including non-public boundaries. */
  declarations: IDartDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: IDartDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether every relevant declaration form was understood. */
  complete: boolean;
}
