import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ICDeclaration } from "./ICDeclaration";
import type { ICDocumentation } from "./ICDocumentation";

/**
 * Preserves all C extraction facts that survive one parser session.
 *
 * `CFileScanner` returns this node-free record so the shared parser can close
 * before cross-record reconciliation begins. The adapter combines declarations
 * and documentation with the captured source, while `diagnostics` and
 * `complete` ensure a partial scan cannot masquerade as a complete inventory.
 */
export interface ICFileAnalysis {
  /** Captured physical source and the configured addresses that expose it. */
  source: IEvidenceSourceFile;

  /** Supported declarations discovered in this file before grouping. */
  declarations: ICDeclaration[];

  /** Doxygen or tag-bearing carriers recorded independently of attachment success. */
  documentation: ICDocumentation[];

  /** Parsing and extraction findings attributed to this source file. */
  diagnostics: IEvidenceDiagnostic[];

  /** Whether scanning found every construct needed for a trustworthy result. */
  complete: boolean;
}
