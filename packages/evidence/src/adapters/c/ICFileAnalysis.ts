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
  /**
   * Captured physical source and the configured addresses that expose it.
   *
   * Materialization uses the source to place units, hosts, and diagnostics in the snapshot.
   */
  source: IEvidenceSourceFile;

  /**
   * Supported declarations discovered in this file before grouping.
   *
   * The adapter reconciles them only with compatible records from the same source.
   */
  declarations: ICDeclaration[];

  /**
   * Doxygen or tag-bearing carriers recorded independently of attachment success.
   *
   * This preserves unsupported annotations for diagnostics instead of silently dropping them.
   */
  documentation: ICDocumentation[];

  /**
   * Parsing and extraction findings attributed to this source file.
   *
   * The adapter copies them into the final inventory rather than shrinking its population.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether scanning found every construct needed for a trustworthy result.
   *
   * A false value prevents a partial source surface from passing coverage checks.
   */
  complete: boolean;
}
