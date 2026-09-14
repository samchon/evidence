/** Execution-local parser acquisition controls, including injectable transport for logic tests. */
export interface ITreeSitterAssetOptions {
  /** Absolute writable cache root; otherwise uses EVIDENCE_CACHE_DIR or the user's OS cache. */
  cacheDirectory?: string;

  /** HTTP transport; defaults to the platform fetch implementation. */
  fetch?: typeof globalThis.fetch;

  /** Maximum duration of each transfer, including its response body. Defaults to 30 seconds. */
  timeoutMilliseconds?: number;

  /** Maximum transfer attempts. Defaults to three. */
  attempts?: number;

  /** Stops this caller's wait without cancelling other callers' acquisitions. */
  signal?: AbortSignal | undefined;

  /** Optional caller-owned diagnostic sink; libraries do not print progress by default. */
  progress?: ((message: string) => void) | undefined;
}
