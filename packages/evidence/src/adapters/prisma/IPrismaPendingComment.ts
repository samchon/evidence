import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { PrismaCommentForm } from "./PrismaCommentForm";

/** Retains one Prisma comment fragment before it is grouped into a run.
 *
 * The line scanner records text and coordinate maps separately so grouping can
 * insert line breaks without losing the original source positions.
 */
export interface IPrismaPendingComment {
  /** Identifies the source syntax used for this comment fragment.
   *
   * Documentation runs distinguish `///` comments from ordinary lines and
   * block comments using this form.
   */
  form: PrismaCommentForm;

  /** Gives the zero-based source line that contains this fragment.
   *
   * Runs use it to preserve blank lines between comments.
   */
  line: number;

  /** Stores the trimmed comment content without delimiters.
   *
   * Its characters correspond positionally to `offsets` and `ends`.
   */
  text: string;

  /** Maps content characters to original UTF-16 start offsets.
   *
   * Whitespace trimming removes matching entries from this map.
   */
  offsets: number[];

  /** Maps content characters to original UTF-16 end offsets.
   *
   * Entries preserve the source boundaries of the retained text.
   */
  ends: number[];

  /** Covers the original comment syntax, including its delimiters.
   *
   * This range remains available even when trimming leaves no content.
   */
  range: IEvidenceSourceRange;

  /** Marks a comment that follows structural code on the same line.
   *
   * Trailing comments never attach as leading documentation for the next
   * declaration.
   */
  trailing: boolean;

  /** Marks a comment discovered while scanner depth is zero.
   *
   * This distinguishes eligible file-level documentation from a detached run
   * nested inside a schema block.
   */
  topLevel: boolean;
}
