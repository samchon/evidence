import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { PrismaCommentForm } from "./PrismaCommentForm";

/** One comment fragment retained on its original source line. */
export interface IPrismaPendingComment {
  form: PrismaCommentForm;
  line: number;
  text: string;
  offsets: number[];
  ends: number[];
  range: IEvidenceSourceRange;
  trailing: boolean;
  topLevel: boolean;
}
