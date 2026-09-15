/**
 * Markdown fence recognized relative to mapped documentation indentation.
 *
 * Tag parsing and HTML precedence share this record so an indented delimiter
 * cannot establish different lexical state in the two passes.
 */
export interface IEvidDocumentationFence {
  /**
   * Backtick or tilde character that owns the fenced region.
   *
   * A closing line must repeat this exact character.
   */
  marker: "`" | "~";

  /**
   * Number of repeated marker characters on this boundary.
   *
   * A closing boundary may be longer but cannot be shorter.
   */
  length: number;

  /**
   * Text following the marker run.
   *
   * Opening boundaries may carry info text, while closing boundaries require
   * this value to contain only whitespace.
   */
  remainder: string;
}
