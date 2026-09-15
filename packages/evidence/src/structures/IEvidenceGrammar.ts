import type { IEvidenceGrammarAsset } from "./IEvidenceGrammarAsset";

/**
 * Pinned provenance for a lazily acquired Tree-sitter syntax variant.
 *
 * The registry uses this record to associate a selectable grammar with upstream
 * source, verified WASM bytes, and license provenance. Listing this metadata
 * does not download the grammar or certify an artifact adapter's declaration
 * coverage.
 */
export interface IEvidenceGrammar {
  /**
   * Unique syntax-variant key used by registry selection and parser caches.
   *
   * A language family may select different keys according to the source
   * filename.
   */
  id: string;

  /**
   * Canonical upstream repository containing the grammar source.
   *
   * This establishes authorship and provenance independently of the download
   * host.
   */
  repository: string;

  /**
   * Upstream release or reproducible build identifier pinned for this grammar.
   *
   * It explains the human-readable revision associated with the immutable
   * assets.
   */
  version: string;

  /**
   * Full upstream source commit associated with the pinned release.
   *
   * The commit disambiguates provenance even if a release tag later moves.
   */
  commit: string;

  /**
   * WASM asset acquired when parsing first requires this variant.
   *
   * Its size and digest are verified before bytes enter the immutable grammar
   * cache.
   */
  wasm: IEvidenceGrammarAsset;

  /**
   * Pinned upstream license asset retained with the grammar provenance.
   *
   * This identifies the exact license text associated with the selected
   * revision, independently of whether a parse has acquired the WASM asset.
   */
  license: IEvidenceGrammarAsset;
}
