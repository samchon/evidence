import type { tags } from "typia";

/** Polling and burst-settling controls for an Evidence watcher. */
export interface IEvidenceWatchOptions {
  /** Delay between dependency snapshots. Defaults to 250 milliseconds. */
  pollIntervalMilliseconds?: number & tags.Type<"uint32"> & tags.Minimum<1>;

  /** Quiet period required before a changed snapshot is checked. Defaults to 100 milliseconds. */
  debounceMilliseconds?: number & tags.Type<"uint32">;

  /** Delay before retrying failed parser acquisition without a filesystem change. Defaults to five seconds. */
  parserRetryMilliseconds?: number & tags.Type<"uint32"> & tags.Minimum<1>;
}
