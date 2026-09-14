import type { IPrismaFileAnalysis } from "./IPrismaFileAnalysis";
import type { IPrismaLocation } from "./IPrismaLocation";

/** Couples a Prisma semantic declaration location with its source analysis.
 *
 * Consumers resolve parser-established identities through this pair without
 * asking the position scanner to decide which Prisma declarations are valid.
 */
export interface IPrismaLocatedDeclaration {
  /** Supplies source-wide locations and comment runs for the declaration.
   *
   * The analysis owns coordinate maps and remains the authority for its
   * physical source snapshot.
   */
  analysis: IPrismaFileAnalysis;

  /** Identifies the parser-matched physical span within that analysis.
   *
   * Its key connects the semantic parser result to a concrete declaration site.
   */
  location: IPrismaLocation;
}
