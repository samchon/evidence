import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";
import type { EvidenceWatchCycle } from "../typings/EvidenceWatchCycle";

import type { WatchDependencySnapshot } from "./WatchDependencySnapshot";

/**
 * Stable unpublished result and dependency baseline for one watch attempt.
 *
 * Publication compares this snapshot after evaluation, preventing source edits
 * during an asynchronous check from being reported as a coherent cycle.
 */
export interface IEvidenceWatchAttempt {
  /** Completed check or operational failure produced by the attempt. */
  cycle: EvidenceWatchCycle;

  /** Full dependency set whose changes invalidate the unpublished result. */
  dependencies: IEvidenceSourceDependency[];

  /** Captured versions proving those dependencies stayed stable during evaluation. */
  snapshot: WatchDependencySnapshot;

  /** Whether parser preparation failed and should be retried independently of source edits. */
  retryParser: boolean;
}
