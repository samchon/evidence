/** One process-wide transfer shared by callers targeting the same immutable cache entry. */
export interface ITreeSitterAssetPending {
  /** Verified bytes, including successful atomic cache publication. */
  promise: Promise<Uint8Array>;

  /** Cancels transfer work when all waiting consumers have left. */
  controller: AbortController;

  /** Number of callers still waiting for this transfer. */
  consumers: number;
}
