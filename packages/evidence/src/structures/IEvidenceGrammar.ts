import type { IEvidenceGrammarAsset } from "./IEvidenceGrammarAsset";

/** Reproducible provenance for one shipped Tree-sitter syntax variant. */
export interface IEvidenceGrammar {
  id: string;
  repository: string;
  version: string;
  /** Full upstream source commit associated with the release tag. */
  commit: string;
  wasm: IEvidenceGrammarAsset;
  license: IEvidenceGrammarAsset;
}
