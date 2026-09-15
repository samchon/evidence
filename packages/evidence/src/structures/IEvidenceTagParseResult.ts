import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceReview } from "./IEvidenceReview";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/**
 * Annotation records extracted from one mapped documentation host.
 *
 * Acknowledgements, reviews, and withdrawals remain separate because they
 * affect coverage, freshness, and public visibility respectively. Invalid
 * annotations retain diagnostics instead of being accepted as evidence or
 * discarded silently.
 */
export interface IEvidenceTagParseResult {
  /**
   * Accepted acknowledgement statements that can contribute coverage.
   *
   * Their authored targets still require resolution against each reference.
   */
  declarations: IEvidenceDeclaration[];

  /**
   * Review statements awaiting citation pairing and fingerprint validation.
   *
   * These never enter the acknowledgement collection or supply coverage alone.
   */
  reviews: IEvidenceReview[];

  /**
   * Accepted directives withdrawing documented declarations from public API.
   *
   * Extraction records the original locations for inherited exclusion
   * diagnostics.
   */
  withdrawals: IEvidenceWithdrawal[];

  /**
   * Findings produced while parsing annotation syntax and host constraints.
   *
   * Retaining them prevents malformed tags from disappearing as ordinary prose.
   */
  diagnostics: IEvidenceDiagnostic[];
}
