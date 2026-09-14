/**
 * Execution-local controls for immutable grammar acquisition.
 *
 * These options influence one caller's cache and transfer lifetime; they do
 * not alter catalog provenance or the bytes accepted into the shared cache.
 */
export interface ITreeSitterAssetOptions {
  /** Writable cache root; omission uses EVIDENCE_CACHE_DIR, then the platform user's cache location. */
  cacheDirectory?: string;

  /** HTTP transport; omission uses the platform fetch implementation. */
  fetch?: typeof globalThis.fetch;

  /** Maximum duration of each transfer, including its response body; omission defaults to 30 seconds. */
  timeoutMilliseconds?: number;

  /** Maximum transfer attempts for transient failures; omission defaults to three. */
  attempts?: number;

  /** Stops this caller's wait without cancelling other callers sharing the immutable transfer. */
  signal?: AbortSignal | undefined;

  /** Optional caller-owned progress sink; omission keeps library acquisition silent. */
  progress?: ((message: string) => void) | undefined;
}
