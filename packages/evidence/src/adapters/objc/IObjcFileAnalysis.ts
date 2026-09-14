import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IObjcDeclaration } from "./IObjcDeclaration";
import type { IObjcDocumentation } from "./IObjcDocumentation";

/** Node-free Objective-C extraction retained after a parse session closes. */
export interface IObjcFileAnalysis {
  /** Snapshot source and its logical aliases. */
  source: IEvidenceSourceFile;

  /** Physical declaration sites before public identity reconciliation. */
  declarations: IObjcDeclaration[];

  /** Attached and unsupported documentation carriers. */
  documentation: IObjcDocumentation[];

  /** Actionable extraction and parser failures. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether all surface-affecting source forms were classified. */
  complete: boolean;
}
