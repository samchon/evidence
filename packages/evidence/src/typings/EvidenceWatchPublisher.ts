import type { EvidenceWatchCycle } from "./EvidenceWatchCycle";

/** Receives each stable watch cycle in order; a returned promise is awaited. */
export type EvidenceWatchPublisher = (cycle: EvidenceWatchCycle) => unknown;
