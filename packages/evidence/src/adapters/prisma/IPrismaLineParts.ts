import type { IPrismaPendingComment } from "./IPrismaPendingComment";

/** Splits one Prisma source line into structural code and comment state.
 *
 * `PrismaFileScanner` carries the block-comment state to the next line while
 * using `code` alone to locate declarations and braces.
 */
export interface IPrismaLineParts {
  /** Contains source characters that remain structural code on this line.
   *
   * Comment delimiters and comment content are excluded so quoted or commented
   * braces cannot change the scanner's nesting depth.
   */
  code: string;

  /** Retains the comment fragment found on this line.
   *
   * Omission means the line contains no comment content, including continued
   * block-comment state with no retained text.
   */
  comment?: IPrismaPendingComment;

  /** States whether a block comment remains open after this line.
   *
   * The next call uses this state to avoid treating comment text as Prisma
   * syntax.
   */
  commented: boolean;
}
