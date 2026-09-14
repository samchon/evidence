/** One valid Markdown fence delimiter after its allowed indentation.
 *
 * Fence records prevent heading and comment-like text inside examples from
 * becoming public Markdown structure or annotation hosts.
 */
export interface IMarkdownFence {
  /** Fence character shared by a matching opener and closer. */
  marker: "`" | "~";

  /** Number of consecutive marker characters in the delimiter. */
  length: number;

  /** Remaining delimiter text used to validate closing fences. */
  remainder: string;
}
