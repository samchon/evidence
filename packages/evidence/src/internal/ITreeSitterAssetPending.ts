/**
 * One process-wide transfer shared by callers targeting the same immutable cache entry.
 *
 * Consumer accounting lets an individual cancellation return promptly while
 * transfer work continues for peers, then aborts only after the final waiter leaves.
 */
export interface ITreeSitterAssetPending {
  /** Promise for verified bytes after any successful atomic cache publication. */
  promise: Promise<Uint8Array>;

  /** Cancels transfer work only when every waiting consumer has left. */
  controller: AbortController;

  /** Number of callers still awaiting this transfer's result. */
  consumers: number;
}
