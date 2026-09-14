import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";

/** Capabilities declared only after an Evidence adapter passes its inventory fixtures. */
export interface IEvidenceDatabaseLanguageAdapter {
  entry: string;
  symbols: EvidenceDatabaseSymbol[];
  publicSurface: string;
  addressing: string;
  comments: string[];
  unsupported: string[];
}
