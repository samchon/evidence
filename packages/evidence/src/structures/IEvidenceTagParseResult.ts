import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceReview } from "./IEvidenceReview";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/** Parsed annotations; reviews never enter the acknowledgement collection. */
export interface IEvidenceTagParseResult {
  declarations: IEvidenceDeclaration[];
  reviews: IEvidenceReview[];
  withdrawals: IEvidenceWithdrawal[];
  diagnostics: IEvidenceDiagnostic[];
}
