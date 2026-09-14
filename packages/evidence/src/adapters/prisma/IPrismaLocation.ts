import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Source position found for one parser-established Prisma identity.
 *
 * Keys connect semantic parser output to physical content without making source
 * scanning guess which declarations the Prisma parser accepts.
 */
export interface IPrismaLocation {
  /** Adapter identity key for the model or model member at this location. */
  key: string;

  /** Exact physical source range used for the materialized site. */
  range: IEvidenceSourceRange;
}
