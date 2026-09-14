import type { tags } from "typia";

/** One upstream asset, pinned by its byte length and SHA-256 digest. */
export interface IEvidenceGrammarAsset {
  /** Slash-separated upstream provenance path; no corresponding package file is required. */
  file: string;

  /** Release or commit-qualified HTTPS source URL used for automatic grammar acquisition. */
  url: string;

  /** Lowercase SHA-256 of the exact upstream bytes; also identifies immutable cache entries. */
  sha256: string & tags.Pattern<"^[0-9a-f]{64}$">;

  /** Exact byte length, used to bound downloads before checksum verification. */
  size: number & tags.Type<"uint32"> & tags.Minimum<1>;
}
