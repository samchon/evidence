import type { EvidWatchCycle } from "./EvidWatchCycle";

/**
 * Subscriber invoked for each stable watch cycle in publication order.
 *
 * Watch waits for a returned promise before publishing the next cycle. That
 * backpressure lets a consumer persist, display, or forward a report without
 * reordering results, while a synchronous subscriber may return `undefined`.
 */
export type EvidWatchPublisher = (cycle: EvidWatchCycle) => unknown;
