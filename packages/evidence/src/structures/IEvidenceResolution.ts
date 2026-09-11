import type { IEvidenceUnit } from "./IEvidenceUnit";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/** Exact address lookup inside one population's structural scope closure. */
export interface IEvidenceResolution {
  status: "resolved" | "ambiguous" | "hidden" | "missing" | "incomplete";
  units: IEvidenceUnit[];
  withdrawals: IEvidenceWithdrawal[];
}
