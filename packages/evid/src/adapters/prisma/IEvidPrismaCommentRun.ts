import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { EvidPrismaCommentForm } from "./EvidPrismaCommentForm";

/** Represents consecutive Prisma comments considered as one documentation run.
 *
 * The position scanner groups fragments before semantic parsing so downstream
 * attachment can retain both the mapped text and the exact source comments.
 */
export interface IEvidPrismaCommentRun {
  /** Identifies the syntax form shared by comments in this run.
   *
   * The form determines whether the run can document a declaration or is kept
   * as an unsupported or detached annotation carrier.
   */
  form: EvidPrismaCommentForm;

  /** Names the declaration location to which this run is attached.
   *
   * An empty key means no declaration received the run.
   */
  key: string;

  /** Marks a documentation run attached to the schema file itself.
   *
   * This is true only for top-level `///` runs with no declaration key.
   */
  fileLevel: boolean;

  /** Stores normalized run text in source-line order.
   *
   * Inserted newlines retain coordinate entries in `offsets` and `ends`.
   */
  text: string;

  /** Maps each text character to its original UTF-16 start offset.
   *
   * The final sentinel maps the end of the run for mapped documentation.
   */
  offsets: number[];

  /** Maps each text character to its original UTF-16 end offset.
   *
   * Its positions correspond to `offsets` and preserve source discontinuities.
   */
  ends: number[];

  /** Covers the complete comment run in original source coordinates.
   *
   * This includes delimiters and line gaps between retained fragments.
   */
  range: IEvidSourceRange;

  /** Lists the physical range of each original comment fragment.
   *
   * Consumers use these ranges when a grouped run must report individual
   * source carriers.
   */
  commentRanges: IEvidSourceRange[];
}
