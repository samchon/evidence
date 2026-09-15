import type { IEvidPrismaFileAnalysis } from "./IEvidPrismaFileAnalysis";
import type { IEvidPrismaLocation } from "./IEvidPrismaLocation";

/** Couples a Prisma semantic declaration location with its source analysis.
 *
 * Consumers resolve parser-established identities through this pair without
 * asking the position scanner to decide which Prisma declarations are valid.
 */
export interface IEvidPrismaLocatedDeclaration {
  /** Supplies source-wide locations and comment runs for the declaration.
   *
   * The analysis owns coordinate maps and remains the authority for its
   * physical source snapshot.
   */
  analysis: IEvidPrismaFileAnalysis;

  /** Identifies the parser-matched physical span within that analysis.
   *
   * Its key connects the semantic parser result to a concrete declaration site.
   */
  location: IEvidPrismaLocation;
}
