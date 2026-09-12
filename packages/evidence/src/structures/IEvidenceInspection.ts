import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceInspectedAcknowledgement } from "./IEvidenceInspectedAcknowledgement";
import type { IEvidenceInspectedObligation } from "./IEvidenceInspectedObligation";
import type { IEvidenceInspectedReview } from "./IEvidenceInspectedReview";
import type { IEvidenceInspectedUnit } from "./IEvidenceInspectedUnit";
import type { IEvidenceQueryScope } from "./IEvidenceQueryScope";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/** Resolution details for one configured population. */
export interface IEvidenceInspection {
  scope: IEvidenceQueryScope;
  status: EvidenceTargetResolutionStatus;
  addresses: string[];
  units: IEvidenceInspectedUnit[];
  withdrawals: IEvidenceWithdrawal[];
  obligations: IEvidenceInspectedObligation[];
  acknowledgements: IEvidenceInspectedAcknowledgement[];
  reviews: IEvidenceInspectedReview[];
  diagnostics: IEvidenceDiagnostic[];
}
