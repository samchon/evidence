import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Source position found for one parser-established Prisma identity.
 *
 * Keys connect semantic parser output to physical content without making source
 * scanning guess which declarations the Prisma parser accepts.
 */
export interface IPrismaLocation {
  /**
   * Adapter identity key for the model or model member at this location.
   *
   * Materialization uses this key to join a lexical declaration span with the
   * semantic parser result without reinterpreting Prisma schema syntax.
   */
  key: string;

  /**
   * Exact physical source range used for the materialized site.
   *
   * The resulting Evidence site owns this range for diagnostics, fingerprints,
   * and documentation attachment in the immutable source snapshot.
   */
  range: IEvidenceSourceRange;
}
