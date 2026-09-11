import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { PrismaCommentForm } from "./PrismaCommentForm";

/** One documentation run and the declaration Prisma attaches it to. */
export interface IPrismaCommentRun {
  form: PrismaCommentForm;
  key: string;
  fileLevel: boolean;
  text: string;
  offsets: number[];
  ends: number[];
  range: IEvidenceSourceRange;
  commentRanges: IEvidenceSourceRange[];
}
