import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IDbmlEndpoint } from "./IDbmlEndpoint";

/** A pending relation whose owning table is resolved across selected files.
 *
 * DBML relation syntax can name aliases outside its physical file, so this
 * record defers ownership and public-address materialization until all selected
 * declarations are available.
 */
export interface IDbmlRelation {
  /** Declared optional relation name.
   *
   * Omission leaves endpoint and cardinality data to establish identity.
   */
  name?: string;

  /** Left endpoint, including the inline declaring column. */
  from: IDbmlEndpoint;

  /** Right endpoint paired with `from` in declared relation order. */
  to: IDbmlEndpoint;

  /** Declared cardinality, retained in semantic identity and fingerprints. */
  cardinality: string;

  /** Whether DBML inline one-to-one ownership rules apply. */
  inline: boolean;

  /** Semantic relation syntax excluding documentation.
   *
   * This excludes annotation carriers so review metadata cannot change relation
   * fingerprint content.
   */
  content: string;

  /** Full declaration site; inline relations share their column site. */
  range: IEvidenceSourceRange;

  /** Temporary syntax identity replaced after endpoint resolution.
   *
   * It exists only until cross-file aliases identify the relation's owner.
   */
  identity: string[];
}
