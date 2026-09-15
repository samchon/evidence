import type { IEvidSourceDependency } from "../structures/IEvidSourceDependency";
import type { EvidWatchCycle } from "../typings/EvidWatchCycle";

import type { EvidWatchDependencySnapshot } from "./EvidWatchDependencySnapshot";

/**
 * Stable unpublished result and dependency baseline for one watch attempt.
 *
 * Publication compares this snapshot after evaluation, preventing source edits
 * during an asynchronous check from being reported as a coherent cycle.
 */
export interface IEvidWatchAttempt {
  /**
   * Completed check or operational failure produced by the attempt.
   *
   * Watch publication exposes this result only after verifying that its captured
   * dependencies still match the associated snapshot.
   */
  cycle: EvidWatchCycle;

  /**
   * Full dependency set whose changes invalidate the unpublished result.
   *
   * This includes source and recoverable-missing dependencies needed to observe
   * repairs as well as ordinary content edits.
   */
  dependencies: IEvidSourceDependency[];

  /**
   * Captured versions proving those dependencies stayed stable during evaluation.
   *
   * Comparing this snapshot before publication prevents an asynchronous check
   * from reporting a result for an already changed source graph.
   */
  snapshot: EvidWatchDependencySnapshot;

  /**
   * Whether parser preparation failed and should be retried independently of source edits.
   *
   * A true value schedules recovery for transient parser setup failures even
   * when no watched source dependency changes.
   */
  retryParser: boolean;
}
