/** One closed HTML comment accepted as Markdown documentation.
 *
 * Offsets and lines let attachment rules distinguish adjacent documentation from
 * comments that belong to fenced content or another structural region.
 */
export interface IMarkdownComment {
  /** UTF-16 start offset of the complete HTML comment. */
  start: number;

  /** Exclusive UTF-16 end offset of the complete HTML comment. */
  end: number;

  /** Zero-based line containing the opening delimiter. */
  startLine: number;

  /** Zero-based line containing the closing delimiter. */
  endLine: number;
}
