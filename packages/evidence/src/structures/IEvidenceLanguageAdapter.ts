import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";

/** Capabilities declared only after an Evidence adapter passes its inventory fixtures. */
export interface IEvidenceLanguageAdapter {
  entry: string;
  symbols: EvidenceProgrammingSymbol[];
  publicSurface: string;
  comments: string[];
  unsupported: string[];
}
