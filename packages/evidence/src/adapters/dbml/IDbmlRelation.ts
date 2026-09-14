import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IDbmlEndpoint } from "./IDbmlEndpoint";

/** A pending relation whose owning table is resolved across selected files. */
export interface IDbmlRelation {
  /** Declared optional relation name. */
  name?: string;

  /** Left endpoint, including the inline declaring column. */
  from: IDbmlEndpoint;

  /** Right endpoint. */
  to: IDbmlEndpoint;

  /** Declared cardinality, retained in semantic identity and fingerprints. */
  cardinality: string;

  /** Whether DBML inline one-to-one ownership rules apply. */
  inline: boolean;

  /** Semantic relation syntax excluding documentation. */
  content: string;

  /** Full declaration site; inline relations share their column site. */
  range: IEvidenceSourceRange;

  /** Temporary syntax identity replaced after endpoint resolution. */
  identity: string[];
}
