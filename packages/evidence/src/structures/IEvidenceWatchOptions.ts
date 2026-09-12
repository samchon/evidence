import type { tags } from "typia";

/** Polling and burst-settling controls for an Evidence watcher. */
export interface IEvidenceWatchOptions {
  /** Delay between dependency snapshots. Defaults to 250 milliseconds. */
  pollIntervalMilliseconds?: number & tags.Type<"uint32"> & tags.Minimum<1>;

  /** Quiet period required before a changed snapshot is checked. Defaults to 100 milliseconds. */
  debounceMilliseconds?: number & tags.Type<"uint32">;
}
