import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidencePrismaCommentRun } from "./IEvidencePrismaCommentRun";
import type { IEvidencePrismaLocation } from "./IEvidencePrismaLocation";

/**
 * Position-only scan of one Prisma schema source.
 *
 * This pass owns original ranges and comments; semantic declarations remain
 * owned by the whole-schema parser result.
 */
export interface IEvidencePrismaFileAnalysis {
  /**
   * Immutable source snapshot whose coordinates the scan records.
   *
   * Every location and comment run in this analysis is valid only for this
   * exact content and supplies its physical identity to later materialization.
   */
  source: IEvidenceSourceFile;

  /**
   * Parser-matchable declaration spans in this physical file.
   *
   * These locations join parser-established model and field identities to their
   * source sites without giving the position scanner semantic ownership.
   */
  locations: IEvidencePrismaLocation[];

  /**
   * Consecutive comment runs available for documentation attachment.
   *
   * Attachment logic uses these physical comment ranges to find eligible
   * carriers after the parser result has identified the declaration they can
   * document.
   */
  comments: IEvidencePrismaCommentRun[];
}
