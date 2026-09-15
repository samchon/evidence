/** One closed HTML comment accepted as Markdown documentation.
 *
 * Offsets and lines let attachment rules distinguish adjacent documentation from
 * comments that belong to fenced content or another structural region.
 */
export interface IEvidMarkdownComment {
  /**
   * Marks the UTF-16 start offset of the complete HTML comment.
   *
   * The scanner uses this offset to preserve the carrier's original source range.
   */
  start: number;

  /**
   * Marks the exclusive UTF-16 end offset of the complete HTML comment.
   *
   * Together with `start`, this bounds the full delimiter-inclusive carrier.
   */
  end: number;

  /**
   * Identifies the zero-based line containing the opening delimiter.
   *
   * Attachment classification begins at this physical source line.
   */
  startLine: number;

  /**
   * Identifies the zero-based line containing the closing delimiter.
   *
   * Multi-line comments remain one carrier through this line.
   */
  endLine: number;
}
