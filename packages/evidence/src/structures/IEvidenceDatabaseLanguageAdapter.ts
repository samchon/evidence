import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";

/** Capabilities declared only after an Evidence adapter passes its inventory fixtures. */
export interface IEvidenceDatabaseLanguageAdapter {
  /** Public adapter constructor name. */
  entry: string;
  /** Certified database selectors. */
  symbols: EvidenceDatabaseSymbol[];
  /** Declared schema boundary established by certification. */
  publicSurface: string;
  /** Canonical qualified address policy. */
  addressing: string;
  /** Supported attached documentation forms. */
  comments: string[];
  /** Known unsupported source capabilities. */
  unsupported: string[];
}
