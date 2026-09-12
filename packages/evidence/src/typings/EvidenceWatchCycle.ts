import type { IEvidenceWatchCheckCycle } from "../structures/IEvidenceWatchCheckCycle";
import type { IEvidenceWatchFailureCycle } from "../structures/IEvidenceWatchFailureCycle";

/** Complete or failed result published by one stable watch cycle. */
export type EvidenceWatchCycle =
  IEvidenceWatchCheckCycle | IEvidenceWatchFailureCycle;
