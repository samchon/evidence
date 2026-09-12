import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";
import type { EvidenceWatchCycle } from "../typings/EvidenceWatchCycle";

import type { WatchDependencySnapshot } from "./WatchDependencySnapshot";

/** Stable unpublished result and dependency baseline for one watch attempt. */
export interface IEvidenceWatchAttempt {
  cycle: EvidenceWatchCycle;
  dependencies: IEvidenceSourceDependency[];
  snapshot: WatchDependencySnapshot;
}
