import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IPrismaCommentRun } from "./IPrismaCommentRun";
import type { IPrismaLocation } from "./IPrismaLocation";

/** Position-only scan of one Prisma schema source. */
export interface IPrismaFileAnalysis {
  source: IEvidenceSourceFile;
  locations: IPrismaLocation[];
  comments: IPrismaCommentRun[];
}
