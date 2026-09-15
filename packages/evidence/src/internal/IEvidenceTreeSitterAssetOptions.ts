/**
 * Execution-local controls for immutable grammar acquisition.
 *
 * These options influence one caller's cache and transfer lifetime; they do not
 * alter catalog provenance or the bytes accepted into the shared cache.
 */
export interface IEvidenceTreeSitterAssetOptions {
  /**
   * Writable root for the immutable grammar cache.
   *
   * Omission first uses `Evidence_CACHE_DIR`, then `node_modules/.cache/evidence` under
   * the current working directory. `EvidenceTreeSitterAssetCache` places verified
   * grammar bytes below this root and never treats it as catalog provenance.
   */
  cacheDirectory?: string;

  /**
   * HTTP transport used to fetch a missing grammar asset.
   *
   * Omission uses the platform fetch implementation. Tests and embedding
   * callers can supply a transport without changing checksum verification or
   * cache keys.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Maximum duration of one transfer, including its response body, in
   * milliseconds.
   *
   * Omission defaults to 30 seconds. The limit applies to each attempt rather
   * than the caller's complete retry lifetime.
   */
  timeoutMilliseconds?: number;

  /**
   * Maximum transfer attempts allowed for transient acquisition failures.
   *
   * Omission defaults to three. Shared callers join one immutable transfer, so
   * this bound controls its retries instead of multiplying requests per
   * caller.
   */
  attempts?: number;

  /**
   * Signal that stops this caller's wait for a grammar acquisition.
   *
   * Aborting one waiter does not cancel other callers sharing the immutable
   * transfer; the cache cancels transfer work only after every waiter leaves.
   */
  signal?: AbortSignal | undefined;

  /**
   * Caller-owned sink for grammar acquisition progress messages.
   *
   * Omission keeps library acquisition silent. The cache reports progress
   * through this callback without writing to process output or changing
   * transfer results.
   */
  progress?: ((message: string) => void) | undefined;
}
