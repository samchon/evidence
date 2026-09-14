import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** One declaration extracted from the DBML syntax tree. */
export interface IDbmlDeclaration {
  /** File-independent schema identity. */
  identity: string[];
  /** Model, scalar column, or separate relation selector. */
  symbol: EvidenceDatabaseSymbol;
  /** Whitespace-independent syntax tokens excluding documentation. */
  content: string;
  /** Exact original declaration span. */
  range: IEvidenceSourceRange;
  /** Explicit table alias, when declared. */
  alias?: string;
}
