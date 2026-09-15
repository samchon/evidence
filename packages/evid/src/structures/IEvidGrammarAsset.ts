import type { tags } from "typia";

/**
 * Immutable upstream asset identified by its size and SHA-256 digest.
 *
 * Grammar metadata uses the same shape for WASM and license provenance. Acquisition
 * can bound a download before hashing it, and cache identity depends on verified
 * bytes rather than trusting a mutable filename or the server response alone.
 */
export interface IEvidGrammarAsset {
  /**
   * Slash-separated filename retained from upstream provenance.
   *
   * It describes the source asset; it does not require a matching file in the
   * published Evid package.
   */
  file: string;

  /**
   * Release- or commit-qualified HTTPS URL for acquiring the asset.
   *
   * Downloaded content must still match the pinned size and digest before use.
   */
  url: string;

  /**
   * Lowercase SHA-256 digest of the exact upstream bytes.
   *
   * Verification rejects altered downloads, and immutable cache entries use this
   * digest to distinguish content independently of its filename.
   */
  sha256: string & tags.Pattern<"^[0-9a-f]{64}$">;

  /**
   * Exact positive byte length expected from the asset.
   *
   * Acquisition uses this bound before checksum verification so an oversized
   * response cannot be accepted as the pinned download.
   */
  size: number & tags.Type<"uint32"> & tags.Minimum<1>;
}
