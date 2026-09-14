import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPrismaCommentRun } from "./IPrismaCommentRun";
import type { IPrismaLocation } from "./IPrismaLocation";

/** Position-only scan of one Prisma schema source.
 *
 * This pass owns original ranges and comments; semantic declarations remain
 * owned by the whole-schema parser result.
 */
export interface IPrismaFileAnalysis {
  /** Immutable source snapshot whose coordinates the scan records. */
  source: IEvidenceSourceFile;

  /** Parser-matchable declaration spans in this physical file. */
  locations: IPrismaLocation[];

  /** Consecutive comment runs available for documentation attachment. */
  comments: IPrismaCommentRun[];
}
