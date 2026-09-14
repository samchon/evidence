/** One valid Markdown fence delimiter after its allowed indentation.
 *
 * Fence records prevent heading and comment-like text inside examples from
 * becoming public Markdown structure or annotation hosts.
 */
export interface IMarkdownFence {
  /**
   * Stores the fence character shared by a matching opener and closer.
   *
   * Markdown requires matching backtick or tilde fence families.
   */
  marker: "`" | "~";

  /**
   * Stores the number of consecutive marker characters in the delimiter.
   *
   * A closing fence must be at least this long to close the example region.
   */
  length: number;

  /**
   * Retains remaining delimiter text used to validate closing fences.
   *
   * Nonblank suffixes prevent a fence-like line from closing the region.
   */
  remainder: string;
}
