import type { IEvidenceGrammarAsset } from "./IEvidenceGrammarAsset";

/** Reproducible provenance for one automatically acquired Tree-sitter syntax variant. */
export interface IEvidenceGrammar {
  /** Unique syntax-variant identifier used by the language registry. */
  id: string;

  /** Canonical upstream grammar repository. */
  repository: string;

  /** Pinned upstream release or reproducible build identifier. */
  version: string;

  /** Full upstream source commit associated with the release tag. */
  commit: string;

  /** Immutable grammar bytes fetched only when a selected source needs them. */
  wasm: IEvidenceGrammarAsset;

  /** Pinned upstream license provenance retained alongside the grammar download metadata. */
  license: IEvidenceGrammarAsset;
}
