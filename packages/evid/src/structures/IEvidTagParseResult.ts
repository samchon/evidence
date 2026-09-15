import type { IEvidDeclaration } from "./IEvidDeclaration";
import type { IEvidDiagnostic } from "./IEvidDiagnostic";
import type { IEvidReview } from "./IEvidReview";
import type { IEvidWithdrawal } from "./IEvidWithdrawal";

/**
 * Annotation records extracted from one mapped documentation host.
 *
 * Acknowledgements, reviews, and withdrawals remain separate because they
 * affect coverage, freshness, and public visibility respectively. Invalid
 * annotations retain diagnostics instead of being accepted as evidence or
 * discarded silently.
 */
export interface IEvidTagParseResult {
  /**
   * Accepted acknowledgement statements that can contribute coverage.
   *
   * Their authored targets still require resolution against each reference.
   */
  declarations: IEvidDeclaration[];

  /**
   * Review statements awaiting citation pairing and fingerprint validation.
   *
   * These never enter the acknowledgement collection or supply coverage alone.
   */
  reviews: IEvidReview[];

  /**
   * Accepted directives withdrawing documented declarations from public API.
   *
   * Extraction records the original locations for inherited exclusion
   * diagnostics.
   */
  withdrawals: IEvidWithdrawal[];

  /**
   * Findings produced while parsing annotation syntax and host constraints.
   *
   * Retaining them prevents malformed tags from disappearing as ordinary prose.
   */
  diagnostics: IEvidDiagnostic[];
}
