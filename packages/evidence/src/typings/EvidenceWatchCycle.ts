import type { IEvidenceWatchCheckCycle } from "../structures/IEvidenceWatchCheckCycle";
import type { IEvidenceWatchFailureCycle } from "../structures/IEvidenceWatchFailureCycle";

/**
 * Published outcome of one debounced, stable watch attempt.
 *
 * A successful cycle contains a completed check report. A failed cycle retains
 * the operational failure separately so subscribers do not mistake a transient
 * scan/configuration error for a completed check with zero violations.
 */
export type EvidenceWatchCycle =
  IEvidenceWatchCheckCycle | IEvidenceWatchFailureCycle;
