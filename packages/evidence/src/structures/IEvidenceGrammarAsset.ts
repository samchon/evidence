/** One packaged upstream file, pinned by its byte length and SHA-256 digest. */
export interface IEvidenceGrammarAsset {
  /** Slash-separated path relative to the package's assets directory. */
  file: string;
  /** Release or commit-qualified source URL; never fetched while checking. */
  url: string;
  sha256: string;
  size: number;
}
