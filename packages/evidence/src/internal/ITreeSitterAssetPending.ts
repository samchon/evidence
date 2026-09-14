/**
 * One process-wide transfer shared by callers targeting the same immutable cache entry.
 *
 * Consumer accounting lets an individual cancellation return promptly while
 * transfer work continues for peers, then aborts only after the final waiter leaves.
 */
export interface ITreeSitterAssetPending {
  /**
   * Promise for verified bytes after successful atomic cache publication.
   *
   * Each joining caller awaits this shared result, so checksum verification and
   * publication run once for the immutable cache entry.
   */
  promise: Promise<Uint8Array>;

  /**
   * Controller that cancels transfer work after every waiting consumer leaves.
   *
   * A single caller's cancellation removes only its own wait and leaves the
   * shared transfer available to remaining consumers.
   */
  controller: AbortController;

  /**
   * Number of callers still awaiting this transfer's result.
   *
   * Asset-cache cancellation decrements this count and aborts the controller
   * only when it reaches zero.
   */
  consumers: number;
}
