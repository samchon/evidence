import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceAddress } from "./IEvidenceAddress";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceUnit } from "./IEvidenceUnit";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/** Serializable result of resolving one file-qualified citation in one population. */
export interface IEvidenceTargetResolution {
  status: EvidenceTargetResolutionStatus;
  /** Absolute addresses derived from every retained citation origin. */
  addresses: IEvidenceAddress[];
  /** One unit when resolved or hidden; every competing unit when ambiguous. */
  units: IEvidenceUnit[];
  withdrawals: IEvidenceWithdrawal[];
  /** Resolution findings, including underlying inventory failures when incomplete. */
  diagnostics: IEvidenceDiagnostic[];
}
